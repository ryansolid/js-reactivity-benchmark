// Inspired by https://github.com/solidjs/solid/blob/main/packages/solid/bench/bench.cjs

import { nextTick } from "../util/asyncUtil";
import { PerfResultCallback } from "../util/perfLogging";
import { Computed, ReactiveFramework, Signal } from "../util/reactiveFramework";

const COUNT = 1e5;

function empty() {}

type Reader = () => number;
export async function sbench(
  framework: ReactiveFramework,
  logPerfResult: PerfResultCallback,
  shouldRun: (test: string) => boolean = () => true,
) {
  if (shouldRun("createSignals")) {
    const createSignalsTime = await run(createSignals, COUNT, COUNT);
    logPerfResult({
      framework: framework.name,
      test: "createSignals",
      time: createSignalsTime,
    });
  }

  const createTests = [
    ["create0to1", create0to1, COUNT, 0],
    ["create1to1", create1to1, COUNT, COUNT],
    ["create2to1", create2to1, COUNT / 2, COUNT],
    ["create4to1", create4to1, COUNT / 4, COUNT],
    ["create1000to1", create1000to1, COUNT / 1000, COUNT],
    ["create1to2", create1to2, COUNT, COUNT / 2],
    ["create1to4", create1to4, COUNT, COUNT / 4],
    ["create1to8", create1to8, COUNT, COUNT / 8],
    ["create1to1000", create1to1000, COUNT, COUNT / 1000],
  ] as const;

  if (shouldRun("createComputations")) {
    let createTotal = 0;
    for (const [, fn, n, scount] of createTests) createTotal += await run(fn, n, scount);
    logPerfResult({
      framework: framework.name,
      test: "createComputations",
      time: createTotal,
    });
  }

  for (const [name, fn, n, scount] of createTests) {
    if (!shouldRun(name)) continue;
    logPerfResult({
      framework: framework.name,
      test: name,
      time: await run(fn, n, scount),
    });
  }

  const updateTests = [
    ["update1to1", update1to1, COUNT * 4, 1],
    ["update2to1", update2to1, COUNT * 2, 2],
    ["update4to1", update4to1, COUNT, 4],
    ["update1000to1", update1000to1, COUNT / 250, 1000],
    ["update1to2", update1to2, COUNT, 1],
    ["update1to4", update1to4, COUNT, 1],
    ["update1to1000", update1to1000, COUNT, 1],
  ] as const;

  if (shouldRun("updateSignals")) {
    let updateTotal = 0;
    for (const [, fn, n, scount] of updateTests) updateTotal += await run(fn, n, scount);
    logPerfResult({
      framework: framework.name,
      test: "updateSignals",
      time: updateTotal,
    });
  }

  for (const [name, fn, n, scount] of updateTests) {
    if (!shouldRun(name)) continue;
    logPerfResult({
      framework: framework.name,
      test: name,
      time: await run(fn, n, scount),
    });
  }

  if (shouldRun("diagnosticEmptyBatch")) {
    logPerfResult({
      framework: framework.name,
      test: "diagnosticEmptyBatch",
      time: await run(diagnosticEmptyBatch, COUNT * 4, 0),
    });
  }

  if (shouldRun("diagnosticWriteNoSubs")) {
    logPerfResult({
      framework: framework.name,
      test: "diagnosticWriteNoSubs",
      time: await run(diagnosticWriteNoSubs, COUNT * 4, 1),
    });
  }

  if (shouldRun("diagnosticWriteSameNoSubs")) {
    logPerfResult({
      framework: framework.name,
      test: "diagnosticWriteSameNoSubs",
      time: await run(diagnosticWriteSameNoSubs, COUNT * 4, 1),
    });
  }

  async function run(
    fn: (n: number, sources: Signal<number>[]) => () => void,
    n: number,
    scount: number,
  ) {
    let sources: Signal<number>[] | null;
    if (globalThis.gc) (gc!(), gc!());
    for (let i = 0; i < 3; i++) {
      let warmupUpdate = framework.withBuild(() => {
        // run 3 times to warm up
        sources = [];
        createSignals(scount, sources);
        return fn(n / 100, sources);
      });
      warmupUpdate();
    }
    sources = null;
    framework.cleanup();

    // start GC clean
    if (globalThis.gc) (gc!(), gc!());
    await nextTick();

    let fastestTime = Infinity;
    for (let i = 0; i < 10; i++) {
      let start = 0;
      let end = 0;
      let update = framework.withBuild(() => {
        sources = [];
        createSignals(scount, sources);
        for (let i = 0; i < scount; i++) {
          sources[i].read();
          sources[i].read();
          sources[i].read();
        }
        start = performance.now();

        return fn(n, sources);
      });

      update();
      sources = null;
      framework.cleanup();
      end = performance.now();

      // end GC clean
      if (globalThis.gc) (gc!(), gc!());

      let time = end - start;
      if (time < fastestTime) {
        fastestTime = time;
      }
    }
    return fastestTime;
  }

  function createSignals(n: number, sources: Computed<number>[]) {
    for (let i = 0; i < n; i++) {
      sources[i] = framework.signal(i);
    }
    return empty;
  }

  function create0to1(n: number, _sources: Computed<number>[]) {
    for (let i = 0; i < n; i++) {
      createComputation0(i);
    }
    return empty;
  }

  function create1to1000(n: number, sources: Computed<number>[]) {
    for (let i = 0; i < n / 1000; i++) {
      const { read: get } = sources[i];
      for (let j = 0; j < 1000; j++) {
        createComputation1(get);
      }
    }
    return empty;
  }

  function create1to8(n: number, sources: Computed<number>[]) {
    for (let i = 0; i < n / 8; i++) {
      const { read: get } = sources[i];
      createComputation1(get);
      createComputation1(get);
      createComputation1(get);
      createComputation1(get);
      createComputation1(get);
      createComputation1(get);
      createComputation1(get);
      createComputation1(get);
    }
    return empty;
  }

  function create1to4(n: number, sources: Computed<number>[]) {
    for (let i = 0; i < n / 4; i++) {
      const { read: get } = sources[i];
      createComputation1(get);
      createComputation1(get);
      createComputation1(get);
      createComputation1(get);
    }
    return empty;
  }

  function create1to2(n: number, sources: Computed<number>[]) {
    for (let i = 0; i < n / 2; i++) {
      const { read: get } = sources[i];
      createComputation1(get);
      createComputation1(get);
    }
    return empty;
  }

  function create1to1(n: number, sources: Computed<number>[]) {
    for (let i = 0; i < n; i++) {
      const { read: get } = sources[i];
      createComputation1(get);
    }
    return empty;
  }

  function create2to1(n: number, sources: Computed<number>[]) {
    for (let i = 0; i < n; i++) {
      createComputation2(sources[i * 2].read, sources[i * 2 + 1].read);
    }
    return empty;
  }

  function create4to1(n: number, sources: Computed<number>[]) {
    for (let i = 0; i < n; i++) {
      createComputation4(
        sources[i * 4].read,
        sources[i * 4 + 1].read,
        sources[i * 4 + 2].read,
        sources[i * 4 + 3].read,
      );
    }
    return empty;
  }

  // only create n / 100 computations, as otherwise takes too long
  function create1000to1(n: number, sources: Computed<number>[]) {
    for (let i = 0; i < n; i++) {
      createComputation1000(sources, i * 1000);
    }
    return empty;
  }

  function createComputation0(i: number) {
    framework.effect(() => i);
    return empty;
  }

  function createComputation1(s1: Reader) {
    framework.effect(() => s1());
    return empty;
  }
  function createComputation2(s1: Reader, s2: Reader) {
    framework.effect(() => s1() + s2());
    return empty;
  }

  function createComputation4(s1: Reader, s2: Reader, s3: Reader, s4: Reader) {
    framework.effect(() => s1() + s2() + s3() + s4());
    return empty;
  }

  function createComputation1000(ss: Computed<number>[], offset: number) {
    framework.effect(() => {
      let sum = 0;
      for (let i = 0; i < 1000; i++) {
        sum += ss[offset + i].read();
      }
      return sum;
    });
    return empty;
  }

  function update1to1(n: number, sources: Signal<number>[]) {
    let { read: get1, write: set1 } = sources[0];
    framework.effect(() => get1());
    return () => {
      for (let i = 0; i < n; i++) {
        framework.withBatch(() => {
          set1(i);
        });
      }
    };
  }

  function diagnosticEmptyBatch(n: number, _sources: Signal<number>[]) {
    return () => {
      for (let i = 0; i < n; i++) {
        framework.withBatch(empty);
      }
    };
  }

  function diagnosticWriteNoSubs(n: number, sources: Signal<number>[]) {
    let { write: set1 } = sources[0];
    return () => {
      for (let i = 0; i < n; i++) {
        framework.withBatch(() => {
          set1(i);
        });
      }
    };
  }

  function diagnosticWriteSameNoSubs(n: number, sources: Signal<number>[]) {
    let { write: set1 } = sources[0];
    return () => {
      for (let i = 0; i < n; i++) {
        framework.withBatch(() => {
          set1(0);
        });
      }
    };
  }

  function update2to1(n: number, sources: Signal<number>[]) {
    let { read: get1, write: set1 } = sources[0],
      { read: get2 } = sources[1];
    framework.effect(() => get1() + get2());
    return () => {
      for (let i = 0; i < n; i++) {
        framework.withBatch(() => {
          set1(i);
        });
      }
    };
  }

  function update4to1(n: number, sources: Signal<number>[]) {
    let { read: get1, write: set1 } = sources[0],
      { read: get2 } = sources[1],
      { read: get3 } = sources[2],
      { read: get4 } = sources[3];
    framework.effect(() => get1() + get2() + get3() + get4());
    return () => {
      for (let i = 0; i < n; i++) {
        framework.withBatch(() => {
          set1(i);
        });
      }
    };
  }

  function update1000to1(n: number, sources: Signal<number>[]) {
    let { write: set1 } = sources[0];
    framework.effect(() => {
      let sum = 0;
      for (let i = 0; i < 1000; i++) {
        sum += sources[i].read();
      }
      return sum;
    });
    return () => {
      for (let i = 0; i < n; i++) {
        framework.withBatch(() => {
          set1(i);
        });
      }
    };
  }

  function update1to2(n: number, sources: Signal<number>[]) {
    let { read: get1, write: set1 } = sources[0];
    framework.effect(() => get1());
    framework.effect(() => get1());
    return () => {
      for (let i = 0; i < n; i++) {
        framework.withBatch(() => {
          set1(i);
        });
      }
    };
  }

  function update1to4(n: number, sources: Signal<number>[]) {
    let { read: get1, write: set1 } = sources[0];
    framework.effect(() => get1());
    framework.effect(() => get1());
    framework.effect(() => get1());
    framework.effect(() => get1());
    return () => {
      for (let i = 0; i < n; i++) {
        framework.withBatch(() => {
          set1(i);
        });
      }
    };
  }

  function update1to1000(n: number, sources: Signal<number>[]) {
    const { read: get1, write: set1 } = sources[0];
    for (let i = 0; i < 1000; i++) {
      framework.effect(() => get1());
    }
    return () => {
      for (let i = 0; i < n / 10; i++) {
        framework.withBatch(() => {
          set1(i);
        });
      }
    };
  }
}
