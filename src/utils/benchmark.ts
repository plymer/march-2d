import { marchingSquaresSimple } from "../simple/helpers.js";
import { marchingSquaresEfficient } from "../efficient/helpers.js";
import { fillGrid } from "./mockup.js";

type MarchFn = (thresholds: number[], griddedData: number[][]) => [number, number][][];

const defaultSizes = [256, 512, 1024];
const thresholds = [-6, 0, 6];
const repeats = Number.parseInt(process.env.BENCH_REPEATS ?? "5", 10);
const warmups = Number.parseInt(process.env.BENCH_WARMUPS ?? "1", 10);

const sizes = (process.env.BENCH_SIZES ?? defaultSizes.join(","))
  .split(",")
  .map((v) => Number.parseInt(v.trim(), 10))
  .filter((v) => Number.isFinite(v) && v > 2);

function bytesToMiB(bytes: number) {
  return bytes / (1024 * 1024);
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return NaN;
  if (n % 2 === 1) return sorted[(n - 1) / 2]!;
  const a = sorted[n / 2 - 1]!;
  const b = sorted[n / 2]!;
  return (a + b) * 0.5;
}

function percentile(values: number[], p: number) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return NaN;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index]!;
}

function forceGC() {
  if (typeof globalThis.gc === "function") {
    globalThis.gc();
  }
}

function benchmark(name: string, fn: MarchFn, grid: number[][], levels: number[]) {
  for (let i = 0; i < warmups; i++) {
    fn(levels, grid);
  }

  forceGC();
  const memBefore = process.memoryUsage();

  const durations: number[] = [];
  let polylineCount = 0;

  for (let i = 0; i < repeats; i++) {
    const t0 = performance.now();
    const polylines = fn(levels, grid);
    const t1 = performance.now();
    durations.push(t1 - t0);
    polylineCount = polylines.length;
  }

  forceGC();
  const memAfter = process.memoryUsage();

  const totalMs = durations.reduce((sum, value) => sum + value, 0);
  const avgMs = totalMs / durations.length;

  console.log(`${name} => polylines=${polylineCount}, runs=${durations.length}`);
  console.log(
    `${name} timing ms: min=${Math.min(...durations).toFixed(3)} median=${median(durations).toFixed(3)} p95=${percentile(durations, 95).toFixed(3)} avg=${avgMs.toFixed(3)}`,
  );
  // console.log(
  //   `${name} memory MiB: heapUsed_before=${bytesToMiB(memBefore.heapUsed).toFixed(2)} heapUsed_after=${bytesToMiB(memAfter.heapUsed).toFixed(2)} rss_before=${bytesToMiB(memBefore.rss).toFixed(2)} rss_after=${bytesToMiB(memAfter.rss).toFixed(2)}`,
  // );
}

console.log("Benchmark configuration");
console.log(
  `sizes=${sizes.join(",")}, thresholds=${thresholds.join(",")}, warmups=${warmups}, repeats=${repeats}`,
);
// console.log("Use NODE_OPTIONS=--expose-gc to enable explicit GC between benchmark phases.");
console.log("");

for (const size of sizes) {
  const griddedData = fillGrid(size, size);

  console.log(`Grid ${size}x${size}`);
  benchmark("efficient", marchingSquaresEfficient, griddedData, thresholds);
  benchmark("simple", marchingSquaresSimple, griddedData, thresholds);
  console.log("");
}
