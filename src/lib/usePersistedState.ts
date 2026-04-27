import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const PREFIX = "sait-sb:";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    try {
      window.localStorage.removeItem(PREFIX + key);
    } catch {
      // ignore
    }
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // quota exceeded or storage disabled — silently drop
  }
}

/**
 * `useState`-shaped hook that mirrors its value to `localStorage` under
 * `sait-sb:<key>`. Read/write are wrapped — corrupt JSON falls back to
 * `defaultValue` (and clears the key); quota errors are swallowed.
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => read(key, defaultValue));
  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    write(keyRef.current, state);
  }, [state]);

  const setter = useCallback<React.Dispatch<React.SetStateAction<T>>>((value) => {
    setState(value);
  }, []);

  return [state, setter];
}

/**
 * Same shape but for `Set<string>` — Sets don't survive JSON, so we (de)serialize
 * to an array transparently.
 */
export function usePersistedStringSet(
  key: string,
  defaultValue: Set<string> = new Set(),
): [Set<string>, (next: Set<string> | ((prev: Set<string>) => Set<string>)) => void] {
  const [arr, setArr] = usePersistedState<string[]>(key, [...defaultValue]);
  const set = useMemo(() => new Set(arr), [arr]);
  const update = useCallback(
    (next: Set<string> | ((prev: Set<string>) => Set<string>)) => {
      setArr((prev) => {
        const prevSet = new Set(prev);
        const result = typeof next === "function" ? next(prevSet) : next;
        return [...result];
      });
    },
    [setArr],
  );
  return [set, update];
}
