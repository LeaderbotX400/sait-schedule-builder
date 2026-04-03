import { useState, useCallback } from "react";
import { searchCourses, type BannerCredentials } from "../lib/api";
import type { BannerResponse } from "../lib/types";

interface Props {
  credentials: BannerCredentials;
  onResults: (data: BannerResponse) => number;
}

export default function CourseSearch({ credentials, onResults }: Props) {
  const [term, setTerm] = useState("202540");
  const [codes, setCodes] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingCode, setLoadingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<
    { code: string; count: number; error?: string }[] | null
  >(null);

  const handleSearch = useCallback(async () => {
    const parsed = codes
      .split(/[,\s\n]+/)
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);

    if (parsed.length === 0) {
      setError("Enter at least one course code (e.g. CPRG307).");
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      // Show which code we're currently fetching
      setLoadingCode(parsed[0]);
      const searchResult = await searchCourses(
        credentials,
        term,
        parsed,
      );

      setLoadingCode(null);
      setResults(searchResult.perCode);

      if (searchResult.response.data.length > 0) {
        onResults(searchResult.response);
      }

      // Check if any codes failed entirely
      const allFailed = searchResult.perCode.every((r) => r.count === 0);
      if (allFailed) {
        const failedCodes = searchResult.perCode
          .map((r) => r.error ? `${r.code} (${r.error})` : r.code)
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
        setError(
          "Session expired or unauthorized. Try reconnecting to Banner.",
        );
      } else if (
        msg.includes("Failed to fetch") ||
        msg.includes("NetworkError")
      ) {
        setError(
          "Could not reach the Banner server. Check your internet connection and that the Vite proxy is running.",
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [credentials, term, codes, onResults]);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-300">Search Courses</h3>

      {/* Term selector */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Term</label>
        <select
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setResults(null);
          }}
          className="w-full rounded-lg bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="202540">Spring 2026</option>
          <option value="202530">Winter 2026</option>
          <option value="202520">Fall 2025</option>
          <option value="202510">Spring 2025</option>
        </select>
      </div>

      {/* Course codes input */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">
          Course codes
        </label>
        <textarea
          value={codes}
          onChange={(e) => {
            setCodes(e.target.value);
            setError(null);
            setResults(null);
          }}
          rows={3}
          placeholder={"CPRG306\nCPRG307\nTHRD318"}
          className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
        />
        <p className="mt-1 text-xs text-gray-600">
          One per line, or comma/space separated
        </p>
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
        disabled={loading || !codes.trim()}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
            {loadingCode ? `Fetching ${loadingCode}...` : "Searching..."}
          </span>
        ) : (
          "Search Banner"
        )}
      </button>
    </div>
  );
}
