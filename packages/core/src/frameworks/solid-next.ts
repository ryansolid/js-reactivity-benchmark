import { ReactiveFramework } from "../util/reactiveFramework";
import {
  createSignal,
  createMemo,
  createRoot,
  flush,
  // @ts-ignore
} from "../../../../../solid/packages/solid-signals/dist/prod.js";

// Solid 2's `flush(fn)` drains at every nesting level (each `flush(fn)`
// honors its own contract: writes inside fn are drained when fn returns).
// To preserve the harness's batch semantics — where writes inside a
// `withBatch` only propagate once at the boundary — we track depth at the
// harness layer, matching the pattern used by `r3` / `r3-solid-target`.
//
// The outermost `withBatch` and top-level `signal.write` calls wrap in
// `flush(fn)` so that signal writes never schedule a redundant microtask
// (Solid's `flush(fn)` keeps `syncDepth > 0` during fn, gating
// `queueMicrotask(flush)` in the scheduler). Nested `withBatch` calls
// just run fn — the outer drain handles them.
let batchDepth = 0;

export const solidNextFramework: ReactiveFramework = {
  name: "solid-next",
  signal: (v) => {
    const [s, set] = createSignal(v);
    return {
      write: (v: any) => {
        if (batchDepth === 0) flush(() => set(v));
        else set(v);
      },
      read: s,
    };
  },
  computed: (fn) => {
    const c = createMemo(fn);
    return {
      read: c,
    };
  },
  effect: (fn) => {
    createMemo(() => {
      fn();
    });
  },
  withBatch: (fn) => {
    batchDepth++;
    try {
      if (batchDepth === 1) flush(fn);
      else fn();
    } finally {
      batchDepth--;
    }
  },
  withBuild: (fn) =>
    createRoot((dispose) => {
      solidNextFramework.cleanup = dispose;
      const out = fn();
      if (batchDepth === 0) flush();
      return out;
    }),
  cleanup: () => {},
};
