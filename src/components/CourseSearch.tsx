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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
    setSuccess(null);

    try {
      const results = await searchCourses(credentials, term, parsed);

      if (!results.data || results.data.length === 0) {
        const codeList = parsed.join(", ");
        setError(
          `No sections found for ${codeList} in the selected term. ` +
          `Check that the course codes are correct and that sections are available.`
        );
        return;
      }

      const count = onResults(results);
      if (count > 0) {
        setSuccess(`Loaded ${results.data.length} section${results.data.length !== 1 ? "s" : ""} across ${new Set(results.data.map((d) => d.subjectCourse)).size} course${new Set(results.data.map((d) => d.subjectCourse)).size !== 1 ? "s" : ""}.`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Search failed";
      if (msg.includes("401") || msg.includes("403")) {
        setError("Session expired or unauthorized. Try reconnecting to Banner.");
      } else if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        setError("Could not reach the Banner server. Check your internet connection and that the Vite proxy is running.");
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
          onChange={(e) => { setTerm(e.target.value); setSuccess(null); }}
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
          onChange={(e) => { setCodes(e.target.value); setError(null); setSuccess(null); }}
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

      {success && (
        <div className="rounded-lg bg-emerald-900/30 border border-emerald-800 px-3 py-2 text-xs text-emerald-400">
          {success}
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
            Searching...
          </span>
        ) : (
          "Search Banner"
        )}
      </button>
    </div>
  );
}
