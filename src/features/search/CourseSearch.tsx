import { useCallback, useEffect, useId, useRef, useState } from "react";
import { BannerAuthRequiredError } from "../../banner-sdk";
import { TERM_OPTIONS } from "../../lib/terms";
import { useStore } from "../../store";
import { getSdk } from "../../store/sdk";
import Spinner from "../../ui/Spinner";

interface Suggestion {
  code: string;
  description: string;
}

/**
 * Course-search panel. Owns the tag-chip input + autocomplete + term picker
 * + result-breakdown UI; pulls term/loadBannerResponse from the store and
 * routes search calls through `sdk.registration.search.byCourses`.
 */
export default function CourseSearch() {
  const term = useStore((s) => s.term);
  const setTerm = useStore((s) => s.setTerm);
  const loadBannerResponse = useStore((s) => s.loadBannerResponse);
  const setAuthRequired = useStore((s) => s.setAuthRequired);

  const [tags, setTags] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingCode, setLoadingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ code: string; count: number; error?: string }[] | null>(
    null,
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  // Debounced autocomplete via the SDK.
  useEffect(() => {
    const trimmed = inputValue.trim().toUpperCase();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSuggestionIndex(-1);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const raw = await getSdk().registration.lookups.subjectCourseCombo({
          term,
          searchTerm: trimmed,
        });
        const filtered = raw.filter((s) => !tags.includes(s.code)).slice(0, 8);
        setSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
        setSuggestionIndex(-1);
      } catch {
        // Autocomplete is best-effort; ignore errors.
      }
    }, 280); // Longer input = more specific search = less need to debounce aggressively.

    return () => clearTimeout(timeout);
  }, [inputValue, term, tags]);

  const commitTag = useCallback(
    (code: string) => {
      const upper = code.trim().toUpperCase();
      if (!upper || tags.includes(upper)) return;
      setTags((prev) => [...prev, upper]);
      setInputValue("");
      setSuggestions([]);
      setShowSuggestions(false);
      setSuggestionIndex(-1);
      inputRef.current?.focus();
    },
    [tags],
  );

  const removeTag = useCallback((code: string) => {
    setTags((prev) => prev.filter((t) => t !== code));
  }, []);

  const handleSearch = useCallback(async () => {
    const pending = inputValue.trim().toUpperCase();
    const allCodes = pending ? [...tags, pending] : tags;
    const deduped = [...new Set(allCodes)];

    if (deduped.length === 0) {
      setError("Enter at least one course code (e.g. CPRG307).");
      return;
    }

    if (pending) {
      setTags(deduped);
      setInputValue("");
    }

    setLoading(true);
    setError(null);
    setResults(null);
    setSuggestions([]);
    setShowSuggestions(false);

    try {
      setLoadingCode(deduped[0] ?? null);
      const searchResult = await getSdk().registration.search.byCourses(deduped, term);
      setLoadingCode(null);
      setResults(searchResult.perCode);

      if (searchResult.response.data.length > 0) {
        loadBannerResponse(searchResult.response);
        // Courses are now visible as chips above; drop the input tags so we
        // don't show the same code in both the input pill and the result row.
        setTags((prev) =>
          prev.filter((t) => !searchResult.perCode.some((r) => r.code === t && r.count > 0)),
        );
      }

      const allFailed = searchResult.perCode.every((r) => r.count === 0);
      if (allFailed) {
        const failedCodes = searchResult.perCode
          .map((r) => (r.error ? `${r.code} (${r.error})` : r.code))
          .join(", ");
        setError(
          `No sections found for ${failedCodes} in the selected term. ` +
            `Check that the course codes are correct and sections are available.`,
        );
      }
    } catch (e) {
      setLoadingCode(null);
      if (e instanceof BannerAuthRequiredError) {
        setError(e.message);
        setAuthRequired(true);
        return;
      }
      const msg = e instanceof Error ? e.message : "Search failed";
      if (msg.includes("401") || msg.includes("403")) {
        setError("Session expired or unauthorized. Try reconnecting to Banner.");
      } else if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        setError(
          "Could not reach the Banner server. Check your internet connection and that the Vite proxy is running.",
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [term, tags, inputValue, loadBannerResponse, setAuthRequired]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSuggestionIndex((i) => Math.min(i + 1, suggestions.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSuggestionIndex((i) => Math.max(i - 1, -1));
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
        setSuggestionIndex(-1);
      } else if (e.key === "Enter" || e.key === "," || e.key === " ") {
        e.preventDefault();
        if (suggestionIndex >= 0 && suggestions[suggestionIndex]) {
          commitTag(suggestions[suggestionIndex].code);
        } else if (inputValue.trim()) {
          commitTag(inputValue);
        } else if (e.key === "Enter" && tags.length > 0) {
          void handleSearch();
        }
      } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
        setTags((prev) => prev.slice(0, -1));
      }
    },
    [suggestions, suggestionIndex, inputValue, tags, commitTag, handleSearch],
  );

  // Highlight the typed portion of a suggestion description.
  const highlight = (text: string, query: string) => {
    const idx = text.toUpperCase().indexOf(query.toUpperCase());
    if (idx === -1) return <span>{text}</span>;
    return (
      <>
        {text.slice(0, idx)}
        <span className="text-fg font-medium">{text.slice(idx, idx + query.length)}</span>
        {text.slice(idx + query.length)}
      </>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-fg-faint">Search</h3>
        <select
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setResults(null);
            setSuggestions([]);
            setShowSuggestions(false);
          }}
          className="rounded-md bg-input border border-edge px-2 py-0.5 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {TERM_OPTIONS.map((t) => (
            <option key={t.code} value={t.code}>
              {t.description}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="relative">
          <div
            className="min-h-[2.5rem] w-full rounded-lg bg-input border border-edge px-2 py-1.5 flex flex-wrap gap-1.5 items-center cursor-text focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent"
            onClick={() => inputRef.current?.focus()}
          >
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded bg-tint-primary border border-tint-primary-bd px-2 py-0.5 text-xs font-mono text-tint-primary-fg"
              >
                {tag}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTag(tag);
                  }}
                  className="text-primary hover:text-fg leading-none"
                  aria-label={`Remove ${tag}`}
                >
                  &times;
                </button>
              </span>
            ))}
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setError(null);
                setResults(null);
              }}
              onKeyDown={handleKeyDown}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder={tags.length === 0 ? "CPRG306, CPRG307…" : ""}
              className="flex-1 min-w-[8rem] bg-transparent text-sm text-fg placeholder-fg-faint font-mono outline-none"
              autoComplete="off"
              spellCheck={false}
              role="combobox"
              aria-expanded={showSuggestions}
              aria-controls={listboxId}
              {...(suggestionIndex >= 0
                ? { "aria-activedescendant": `${listboxId}-${suggestionIndex}` }
                : {})}
            />
          </div>

          {/* Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <ul
              id={listboxId}
              role="listbox"
              className="absolute z-20 mt-1 w-full rounded-lg bg-input border border-edge shadow-lg overflow-hidden"
            >
              {suggestions.map((s, i) => (
                <li
                  key={s.code}
                  id={`${listboxId}-${i}`}
                  role="option"
                  aria-selected={i === suggestionIndex}
                  onMouseDown={() => commitTag(s.code)}
                  onMouseEnter={() => setSuggestionIndex(i)}
                  className={`px-3 py-2 text-sm cursor-pointer flex items-baseline gap-2 ${
                    i === suggestionIndex
                      ? "bg-primary/40 text-fg"
                      : "text-fg-muted hover:bg-surface-hover"
                  }`}
                >
                  <span className="font-mono text-xs text-fg-muted shrink-0">{s.code}</span>
                  <span className="text-xs text-fg-faint truncate">
                    {highlight(s.description.replace(s.code, "").trim(), inputValue.trim())}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-tint-danger border border-tint-danger-bd px-3 py-2 text-xs text-tint-danger-fg">
          {error}
        </div>
      )}

      {/* Per-code results breakdown */}
      {results && (
        <div className="rounded-lg bg-input/50 border border-edge px-3 py-2 space-y-0.5">
          {results.map((r) => (
            <div key={r.code} className="flex items-center gap-2 text-xs">
              {r.count > 0 ? (
                <span className="text-success">&#x2713;</span>
              ) : (
                <span className="text-destructive">&#x2717;</span>
              )}
              <span className="font-mono text-fg-muted">{r.code}</span>
              {r.count > 0 ? (
                <span className="text-fg-faint">
                  {r.count} section{r.count !== 1 ? "s" : ""}
                </span>
              ) : (
                <span className="text-destructive/70">{r.error ?? "no sections found"}</span>
              )}
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={handleSearch}
        disabled={loading || (tags.length === 0 && !inputValue.trim())}
        className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Spinner size="md" color="text-primary-fg" />
            {loadingCode ? `Fetching ${loadingCode}…` : "Searching…"}
          </span>
        ) : (
          "Search Banner"
        )}
      </button>
    </div>
  );
}
