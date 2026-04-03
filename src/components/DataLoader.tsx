import { useCallback, useRef, useState } from "react";

interface Props {
  onLoad: (json: unknown) => void;
  error?: string | null;
}

export default function DataLoader({ onLoad, error: externalError }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const error = externalError ?? localError;

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setLocalError(null);

      if (!file.name.endsWith(".json")) {
        setLocalError(`Expected a .json file, got "${file.name}".`);
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => {
        setLocalError("Failed to read the file. It may be too large or inaccessible.");
      };
      reader.onload = () => {
        try {
          const json = JSON.parse(reader.result as string);
          onLoad(json);
        } catch {
          setLocalError("The file contains invalid JSON. Make sure it's a valid data.json from the Banner API.");
        }
      };
      reader.readAsText(file);
    },
    [onLoad],
  );

  const handlePaste = useCallback(() => {
    const text = textRef.current?.value?.trim();
    if (!text) {
      setLocalError("Paste some JSON first.");
      return;
    }
    setLocalError(null);
    try {
      const json = JSON.parse(text);
      onLoad(json);
    } catch {
      setLocalError("Invalid JSON. Make sure you copied the full contents of data.json.");
    }
  }, [onLoad]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Upload data.json
        </label>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          onChange={handleFile}
          className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-500 file:cursor-pointer"
        />
      </div>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-700" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-gray-900 px-2 text-gray-500">or paste JSON</span>
        </div>
      </div>
      <div>
        <textarea
          ref={textRef}
          rows={4}
          placeholder='{"success": true, "data": [...]}'
          className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
        />
        <button
          onClick={handlePaste}
          className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
        >
          Load JSON
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-900/30 border border-red-800 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
