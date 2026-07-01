import {
  frameworkInfo,
  formatPerfResult,
  PerfResult,
  perfResultHeaders,
  runTests,
} from "js-reactivity-benchmark/src/index";

function logLine(line: string): void {
  console.log(line);
}

function logPerfResult(result: PerfResult): void {
  logLine(
    formatPerfResult({
      framework: result.framework,
      test: result.test,
      time: result.time.toFixed(2),
    }),
  );
}

async function main() {
  logLine(formatPerfResult(perfResultHeaders()));
  const tests = process.env.TESTS?.split(",").filter(Boolean);
  const frameworks = process.env.FRAMEWORKS?.split(",").filter(Boolean);
  const selectedFrameworks = frameworks
    ? new Set(frameworks)
    : undefined;
  await runTests(
    selectedFrameworks
      ? frameworkInfo.filter(({ framework }) => selectedFrameworks.has(framework.name))
      : frameworkInfo,
    logPerfResult,
    { tests },
  );
}

main();
