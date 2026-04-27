import { useState, useCallback, useEffect, useRef, useId } from "react";
import { searchCourses, searchSubjects, type BannerCredentials } from "../lib/api";
import type { BannerResponse } from "../lib/types";

interface Props {
  credentials: BannerCredentials;
  onResults: (data: BannerResponse) => number;
}

interface Suggestion {
  code: string;
  description: string;
}

export default function CourseSearch({ credentials, onResults }: Props) {
  const [term, setTerm] = useState("202540");
  const [tags, setTags] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingCode, setLoadingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<
    { code: string; count: number; error?: string }[] | null
  >(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  // Debounced autocomplete
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
        const raw = await searchSubjects(credentials, term, trimmed);
        const filtered = raw.filter((s) => !tags.includes(s.code)).slice(0, 8);
        setSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
        setSuggestionIndex(-1);
      } catch {
        // Autocomplete is best-effort; ignore errors
      }
    }, 280);

    return () => clearTimeout(timeout);
  }, [inputValue, term, credentials, tags]);

  const commitTag = useCallback((code: string) => {
    const upper = code.trim().toUpperCase();
    if (!upper || tags.includes(upper)) return;
    setTags((prev) => [...prev, upper]);
    setInputValue("");
    setSuggestions([]);
    setShowSuggestions(false);
    setSuggestionIndex(-1);
    inputRef.current?.focus();
  }, [tags]);

  const removeTag = useCallback((code: string) => {
    setTags((prev) => prev.filter((t) => t !== code));
  }, []);

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
          handleSearch();
        }
      } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
        setTags((prev) => prev.slice(0, -1));
      }
    },
    [suggestions, suggestionIndex, inputValue, tags, commitTag],
  );

  const handleSearch = useCallback(async () => {
    // Commit any partially-typed code first
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
      setLoadingCode(deduped[0]);
      const searchResult = await searchCourses(credentials, term, deduped);
      setLoadingCode(null);
      setResults(searchResult.perCode);

      if (searchResult.response.data.length > 0) {
        onResults(searchResult.response);
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
  }, [credentials, term, tags, inputValue, onResults]);

  // Highlight the typed portion of a suggestion description
  const highlight = (text: string, query: string) => {
    const idx = text.toUpperCase().indexOf(query.toUpperCase());
    if (idx === -1) return <span>{text}</span>;
    return (
      <>
        {text.slice(0, idx)}
        <span className="text-white font-medium">{text.slice(idx, idx + query.length)}</span>
        {text.slice(idx + query.length)}
      </>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Search
        </h3>
        <select
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setResults(null);
            setSuggestions([]);
            setShowSuggestions(false);
          }}
          className="rounded-md bg-gray-800 border border-gray-700 px-2 py-0.5 text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="202540">Spring 2026</option>
          <option value="202530">Winter 2026</option>
          <option value="202520">Fall 2025</option>
          <option value="202510">Spring 2025</option>
        </select>
      </div>

      <div>
        <div className="relative">
          {/* Tag chips + text input */}
          <div
            className="min-h-[2.5rem] w-full rounded-lg bg-gray-800 border border-gray-700 px-2 py-1.5 flex flex-wrap gap-1.5 items-center cursor-text focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent"
            onClick={() => inputRef.current?.focus()}
          >
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded bg-blue-900/60 border border-blue-700 px-2 py-0.5 text-xs font-mono text-blue-200"
              >
                {tag}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                  className="text-blue-400 hover:text-white leading-none"
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
              className="flex-1 min-w-[8rem] bg-transparent text-sm text-gray-200 placeholder-gray-600 font-mono outline-none"
              autoComplete="off"
              spellCheck={false}
              role="combobox"
              aria-expanded={showSuggestions}
              aria-controls={listboxId}
              aria-activedescendant={
                suggestionIndex >= 0 ? `${listboxId}-${suggestionIndex}` : undefined
              }
            />
          </div>

          {/* Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <ul
              id={listboxId}
              role="listbox"
              className="absolute z-20 mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 shadow-lg overflow-hidden"
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
                    i === suggestionIndex ? "bg-blue-700/40 text-gray-100" : "text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  <span className="font-mono text-xs text-gray-400 shrink-0">{s.code}</span>
                  <span className="text-xs text-gray-500 truncate">
                    {highlight(s.description.replace(s.code, "").trim(), inputValue.trim())}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-900/30 border border-red-800 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Per-code results breakdown */}
      {results && (
        <div className="rounded-lg bg-gray-800/50 border border-gray-700 px-3 py-2 space-y-0.5">
          {results.map((r) => (
            <div key={r.code} className="flex items-center gap-2 text-xs">
              {r.count > 0 ? (
                <span className="text-emerald-400">&#x2713;</span>
              ) : (
                <span className="text-red-400">&#x2717;</span>
              )}
              <span className="font-mono text-gray-300">{r.code}</span>
              {r.count > 0 ? (
                <span className="text-gray-500">
                  {r.count} section{r.count !== 1 ? "s" : ""}
                </span>
              ) : (
                <span className="text-red-400/70">
                  {r.error ?? "no sections found"}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleSearch}
        disabled={loading || (tags.length === 0 && !inputValue.trim())}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
            {loadingCode ? `Fetching ${loadingCode}…` : "Searching…"}
          </span>
        ) : (
          "Search Banner"
        )}
      </button>
    </div>
  );
}
