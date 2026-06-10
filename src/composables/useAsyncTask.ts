import { tryOnScopeDispose } from "@vueuse/core";
import { type Ref, ref, type ShallowRef, shallowRef, watch, type WatchSource } from "vue";

/**
 * Latest-wins async task primitive — the one implementation of the
 * `runId` cancellation-token pattern the data-loading composables share.
 *
 * Every `run()` supersedes any in-flight run: the stale run's result is
 * discarded (it resolves `undefined` and writes nothing), and `ctx`
 * lets the task function bail out early at its own await points.
 * Cancellation is automatic on scope dispose.
 */
export interface AsyncTaskContext {
  /** True once this run has been superseded or cancelled. */
  isStale(): boolean;
  /** Aborted when this run is superseded or cancelled. */
  signal: AbortSignal;
}

export interface UseAsyncTaskOptions {
  /** Re-run automatically when these sources change. */
  watch?: WatchSource | WatchSource[];
  /** Gate auto-runs (watch/immediate); manual `run()` calls are not gated. */
  enabled?: () => boolean;
  /** Run once on creation (gated by `enabled`). */
  immediate?: boolean;
  /** Retry failed runs. `when` filters which errors are retryable. */
  retry?: { times: number; delayMs: number; when?: (err: unknown) => boolean };
  /** Called for failures of non-stale runs (after retries are exhausted). */
  onError?: (err: unknown) => void;
}

export interface AsyncTask<T> {
  data: ShallowRef<T | undefined>;
  error: ShallowRef<unknown>;
  isLoading: Ref<boolean>;
  /** Start a run. Superseded runs resolve `undefined` and write nothing. */
  run(): Promise<T | undefined>;
  /** Supersede any in-flight run without starting a new one. */
  cancel(): void;
}

export function useAsyncTask<T>(
  fn: (ctx: AsyncTaskContext) => Promise<T>,
  opts: UseAsyncTaskOptions = {},
): AsyncTask<T> {
  const data = shallowRef<T | undefined>(undefined);
  const error = shallowRef<unknown>(undefined);
  const isLoading = ref(false);

  let runId = 0;
  let controller: AbortController | null = null;

  function cancel(): void {
    runId++;
    controller?.abort();
    controller = null;
    isLoading.value = false;
  }

  async function run(): Promise<T | undefined> {
    const myRunId = ++runId;
    controller?.abort();
    const myController = new AbortController();
    controller = myController;

    const ctx: AsyncTaskContext = {
      isStale: () => myRunId !== runId,
      signal: myController.signal,
    };

    isLoading.value = true;
    error.value = undefined;

    const retry = opts.retry;
    let attempt = 0;
    try {
      for (;;) {
        try {
          const result = await fn(ctx);
          if (ctx.isStale()) return undefined;
          data.value = result;
          return result;
        } catch (err) {
          if (ctx.isStale()) return undefined;
          const retryable =
            retry !== undefined && attempt < retry.times && (retry.when?.(err) ?? true);
          if (!retryable) {
            error.value = err;
            opts.onError?.(err);
            return undefined;
          }
          attempt++;
          await delay(retry.delayMs);
          if (ctx.isStale()) return undefined;
        }
      }
    } finally {
      if (myRunId === runId) isLoading.value = false;
    }
  }

  function autoRun(): void {
    if (opts.enabled && !opts.enabled()) return;
    void run();
  }

  if (opts.watch) {
    watch(opts.watch, autoRun, { flush: "post" });
  }
  if (opts.immediate) autoRun();

  tryOnScopeDispose(cancel);

  return { data, error, isLoading, run, cancel };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
