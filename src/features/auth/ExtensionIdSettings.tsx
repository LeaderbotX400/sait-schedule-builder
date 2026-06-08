import { useEffect, useState } from "react";
import {
  getExtensionId,
  isExtensionContext,
  setExtensionId,
  subscribeExtensionId,
} from "../../lib/extensionId";

/**
 * Lets the user view / paste the chrome extension ID when the app is running
 * outside the extension (dev server, AI, pages.dev). Hidden when running as
 * the extension's own page since the ID is implicit.
 */
export default function ExtensionIdSettings() {
  const [extensionId, setLocalId] = useState<string | null>(() => getExtensionId());
  const [draft, setDraft] = useState<string>(() => getExtensionId() ?? "");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const unsub = subscribeExtensionId((id) => {
      setLocalId(id);
      if (!editing) setDraft(id ?? "");
    });
    return unsub;
  }, [editing]);

  if (isExtensionContext()) return null;

  const detected = extensionId != null && extensionId.length > 0;

  return (
    <details className="mt-4 text-xs">
      <summary className="cursor-pointer text-fg-faint hover:text-fg-muted select-none">
        Extension ID:{" "}
        {detected ? (
          <span className="font-mono text-fg-muted">
            {extensionId?.slice(0, 8)}…{extensionId?.slice(-4)}
          </span>
        ) : (
          <span className="text-destructive">not set</span>
        )}
      </summary>
      <div className="mt-2 space-y-2">
        <p className="text-fg-faint">
          Auto-detected from the extension's content script on this page. Override below if
          detection fails (e.g. content script blocked).
        </p>
        {editing ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value.trim())}
              placeholder="abcdefghijklmnopabcdefghijklmnop"
              className="flex-1 rounded-md border border-edge bg-surface px-2 py-1 font-mono text-fg"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => {
                setExtensionId(draft.length > 0 ? draft : null);
                setEditing(false);
              }}
              className="rounded-md bg-primary px-2 py-1 text-primary-fg hover:bg-primary-hover"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(extensionId ?? "");
                setEditing(false);
              }}
              className="rounded-md border border-edge px-2 py-1 text-fg-muted hover:text-fg"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md border border-edge px-2 py-1 text-fg-muted hover:text-fg"
          >
            {detected ? "Override" : "Set extension ID"}
          </button>
        )}
      </div>
    </details>
  );
}
