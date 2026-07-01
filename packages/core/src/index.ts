import { dynamicBench } from "./benches/reactively/dynamicBench";
import { cellxbench } from "./benches/cellxBench";
import { sbench } from "./benches/sBench";
import { kairoBench } from "./benches/kairoBench";
import { promiseDelay } from "./util/asyncUtil";
import type { FrameworkInfo } from "./util/frameworkTypes";
import { PerfResultCallback } from "./util/perfLogging";

export interface RunOptions {
  tests?: readonly string[];
}

export type { ReactiveFramework } from "./util/reactiveFramework";
export {
  perfResultHeaders,
  formatPerfResult,
  type PerfResult,
  type PerfResultStrings,
  type PerfResultCallback,
} from "./util/perfLogging";
export { frameworkInfo, allFrameworks } from ".//frameworksList";
export type { FrameworkInfo };

export async function runTests(
  frameworkInfo: FrameworkInfo[],
  logPerfResult: PerfResultCallback,
  options: RunOptions = {},
) {
  await promiseDelay(0);
  const selectedTests = options.tests && new Set(options.tests);
  const shouldRun = (test: string) => !selectedTests || selectedTests.has(test);

  for (const { framework } of frameworkInfo) {
    await sbench(framework, logPerfResult, shouldRun);
    if (!selectedTests) await promiseDelay(1000);
  }

  await kairoBench(frameworkInfo, logPerfResult, shouldRun);

  // await cellxbench(frameworkInfo, logPerfResult);
  if (!selectedTests) await promiseDelay(1000);

  if (!selectedTests || ["4-1000x12 - dyn5%", "25-1000x5", "3-5x500", "6-100x15 - dyn50%"].some(shouldRun)) {
    await dynamicBench(frameworkInfo, logPerfResult, 5, shouldRun);
    await promiseDelay(1000);
  }
}
