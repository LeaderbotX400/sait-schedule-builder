import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import { useAsyncTask } from "../useAsyncTask";

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useAsyncTask", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("resolves data and clears loading", async () => {
    const task = useAsyncTask(async () => 42);
    const result = await task.run();
    expect(result).toBe(42);
    expect(task.data.value).toBe(42);
    expect(task.isLoading.value).toBe(false);
    expect(task.error.value).toBeUndefined();
  });

  it("latest-wins: a superseded run writes nothing and resolves undefined", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    let call = 0;
    const task = useAsyncTask(() => (++call === 1 ? first.promise : second.promise));

    const p1 = task.run();
    const p2 = task.run();
    second.resolve("second");
    first.resolve("first");

    expect(await p1).toBeUndefined();
    expect(await p2).toBe("second");
    expect(task.data.value).toBe("second");
    expect(task.isLoading.value).toBe(false);
  });

  it("aborts the superseded run's signal", async () => {
    const gate = deferred<void>();
    const seen: boolean[] = [];
    const task = useAsyncTask(async (ctx) => {
      await gate.promise;
      seen.push(ctx.signal.aborted, ctx.isStale());
      return 1;
    });
    const p1 = task.run();
    const p2 = task.run();
    gate.resolve();
    await Promise.all([p1, p2]);
    // First run saw aborted+stale; second saw live.
    expect(seen).toEqual([true, true, false, false]);
  });

  it("records errors and calls onError for non-stale failures", async () => {
    const onError = vi.fn();
    const boom = new Error("boom");
    const task = useAsyncTask(async () => {
      throw boom;
    }, { onError });
    const result = await task.run();
    expect(result).toBeUndefined();
    expect(task.error.value).toBe(boom);
    expect(onError).toHaveBeenCalledWith(boom);
    expect(task.isLoading.value).toBe(false);
  });

  it("retries per the retry option, honoring the `when` filter", async () => {
    let attempts = 0;
    const task = useAsyncTask(
      async () => {
        attempts++;
        if (attempts < 3) throw new Error("transient");
        return "ok";
      },
      { retry: { times: 5, delayMs: 1000, when: (e) => (e as Error).message === "transient" } },
    );
    const p = task.run();
    await vi.advanceTimersByTimeAsync(2000);
    expect(await p).toBe("ok");
    expect(attempts).toBe(3);
  });

  it("does not retry when `when` rejects the error", async () => {
    let attempts = 0;
    const task = useAsyncTask(
      async () => {
        attempts++;
        throw new Error("fatal");
      },
      { retry: { times: 5, delayMs: 1000, when: () => false } },
    );
    await task.run();
    expect(attempts).toBe(1);
    expect((task.error.value as Error).message).toBe("fatal");
  });

  it("cancel supersedes the in-flight run", async () => {
    const gate = deferred<string>();
    const task = useAsyncTask(() => gate.promise);
    const p = task.run();
    task.cancel();
    gate.resolve("late");
    expect(await p).toBeUndefined();
    expect(task.data.value).toBeUndefined();
    expect(task.isLoading.value).toBe(false);
  });

  it("auto-runs on watch sources, gated by enabled", async () => {
    const source = ref(0);
    const enabled = ref(false);
    let runs = 0;
    useAsyncTask(async () => ++runs, {
      watch: source,
      enabled: () => enabled.value,
    });

    source.value = 1;
    await nextTick();
    expect(runs).toBe(0);

    enabled.value = true;
    source.value = 2;
    await nextTick();
    expect(runs).toBe(1);
  });

  it("cancels automatically on scope dispose", async () => {
    const gate = deferred<string>();
    const scope = effectScope();
    const task = scope.run(() => useAsyncTask(() => gate.promise))!;
    const p = task.run();
    scope.stop();
    gate.resolve("late");
    expect(await p).toBeUndefined();
    expect(task.data.value).toBeUndefined();
  });
});
