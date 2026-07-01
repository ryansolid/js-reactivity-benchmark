import { ReactiveFramework } from "../util/reactiveFramework";
import {
  computed,
  read,
  setSignal,
  signal,
  stabilize,
} from "../lib/r3";

let batchDepth = 0;
export const r3Framework: ReactiveFramework = {
  name: "r3",
  signal: (v) => {
    const s = signal(v);
    return {
      write: (v: any) => {
        setSignal(s, v);
        if (batchDepth === 0) stabilize();
      },
      read: () => read(s),
    };
  },
  computed: (fn) => {
    const c = computed(fn);
    return {
      read: () => read(c),
    };
  },
  effect: (fn) => {
    computed(() => {
      fn();
    });
  },
  withBatch: (fn) => {
    batchDepth++;
    fn();
    batchDepth--;
    if (batchDepth === 0) stabilize();
  },
  withBuild: (fn) => {
    let out = fn();
    if (batchDepth === 0) stabilize();
    return out;
  },
  cleanup: () => {},
};