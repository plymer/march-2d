import { marchingSquaresSimple } from "../simple/helpers.js";
import { marchingSquares } from "../efficient/helpers.js";
import { fillGrid } from "./mockup.js";
import { contours, type ContourMultiPolygon } from "d3-contour";
import type { PolylinesWithLevels } from "./types.js";

type D3ContoursWithSmooth = ReturnType<typeof contours> & {
  smooth: (enabled: boolean) => ReturnType<typeof contours>;
};

type Point = [number, number];
type PointLine = Point[];

const contourThresholdEpsilon = Number.parseFloat(process.env.BENCH_THRESHOLD_EPSILON ?? "1e-9");
const pointEqualityEpsilon = Number.parseFloat(process.env.BENCH_POINT_EPSILON ?? "1e-9");

type BenchSummary = {
  polylineCount: number;
  pointCount: number;
  invalidPointCount: number;
  emptyPolylineCount: number;
};

type BenchmarkResult = {
  contender: string;
  avgMs: number;
  minMs: number;
  medianMs: number;
  p95Ms: number;
};

type BenchOutput = PolylinesWithLevels | PointLine[] | ContourMultiPolygon[];

type Contender = {
  name: string;
  setup: (
    grid: number[][],
    levels: number[],
  ) => {
    runCore: () => BenchOutput;
    summarize: (output: BenchOutput) => BenchSummary;
  };
  setupNotes?: string;
};

const defaultSizes = [256, 512, 1024];
const defaultThresholds = [-6, 0, 6];
const defaultDatasets = ["quantized", "smooth"];

const repeats = Number.parseInt(process.env.BENCH_REPEATS ?? "10", 10);
const warmups = Number.parseInt(process.env.BENCH_WARMUPS ?? "1", 10);

const sizes = (process.env.BENCH_SIZES ?? defaultSizes.join(","))
  .split(",")
  .map((v) => Number.parseInt(v.trim(), 10))
  .filter((v) => Number.isFinite(v) && v > 2);

const thresholds = (process.env.BENCH_THRESHOLDS ?? defaultThresholds.join(","))
  .split(",")
  .map((v) => Number.parseFloat(v.trim()))
  .filter((v) => Number.isFinite(v));

const datasets = (process.env.BENCH_DATASETS ?? defaultDatasets.join(","))
  .split(",")
  .map((v) => v.trim().toLowerCase())
  .filter((v) => v.length > 0);

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

function pointsEqual(a: Point, b: Point, eps = pointEqualityEpsilon) {
  return Math.abs(a[0] - b[0]) <= eps && Math.abs(a[1] - b[1]) <= eps;
}

function normalizeLineForCounting(line: PointLine) {
  if (line.length <= 1) return line;

  const cleaned: PointLine = [line[0]!];

  for (let i = 1; i < line.length; i++) {
    const current = line[i]!;
    const previous = cleaned[cleaned.length - 1]!;
    if (!pointsEqual(previous, current)) cleaned.push(current);
  }

  // d3 rings are commonly closed by repeating the first point at the end.
  if (cleaned.length > 2 && pointsEqual(cleaned[0]!, cleaned[cleaned.length - 1]!)) {
    cleaned.pop();
  }

  return cleaned;
}

function summarizePolylinesPacked(polylines: PolylinesWithLevels): BenchSummary {
  let pointCount = polylines.polylines.reduce((sum, line) => sum + line.length, 0);
  let polylineCount = polylines.polylines.length;

  return {
    polylineCount,
    pointCount,
    invalidPointCount: 0,
    emptyPolylineCount: 0,
  };
}

function summarizePolylines(polylines: PointLine[]): BenchSummary {
  let pointCount = 0;
  let invalidPointCount = 0;
  let emptyPolylineCount = 0;

  for (const rawLine of polylines) {
    const line = normalizeLineForCounting(rawLine);

    if (line.length === 0) {
      emptyPolylineCount++;
      continue;
    }

    for (const point of line) {
      pointCount++;

      const x = point[0];
      const y = point[1];
      if (!Number.isFinite(x) || !Number.isFinite(y)) invalidPointCount++;
    }
  }

  return {
    polylineCount: polylines.length,
    pointCount,
    invalidPointCount,
    emptyPolylineCount,
  };
}

function flattenGridForD3(grid: number[][]) {
  const yDim = grid.length;
  const xDim = grid[0]?.length;

  if (xDim === undefined || xDim === 0 || yDim === 0) {
    throw new Error("Grid input is invalid");
  }

  const values = new Float64Array(xDim * yDim);

  for (let y = 0; y < yDim; y++) {
    const row = grid[y];
    if (!row || row.length !== xDim) throw new Error("Grid rows are not rectangular");
    for (let x = 0; x < xDim; x++) {
      values[y * xDim + x] = row[x]!;
    }
  }

  return { values, xDim, yDim };
}

function summarizeD3Isolines(contourSet: ContourMultiPolygon[]): BenchSummary {
  const lines: PointLine[] = [];

  for (const contour of contourSet) {
    for (const polygon of contour.coordinates) {
      for (const ring of polygon) {
        const line: PointLine = ring.map((point) => [point[0]!, point[1]!]);
        lines.push(line);
      }
    }
  }

  return summarizePolylines(lines);
}

function buildSmoothGrid(xDim: number, yDim: number) {
  const grid: number[][] = [];

  for (let y = 0; y < yDim; y++) {
    grid.push([]);
    for (let x = 0; x < xDim; x++) {
      const value =
        4 * (Math.sin(y * 0.2) + Math.cos(x * 0.2)) +
        1.25 * Math.sin((x + y) * 0.07) +
        0.75 * Math.cos((x - y) * 0.09);
      grid[y]!.push(value);
    }
  }

  return grid;
}

function makeGrid(kind: string, size: number) {
  switch (kind) {
    case "quantized":
      return fillGrid(size, size);
    case "smooth":
      return buildSmoothGrid(size, size);
    default:
      throw new Error(`Unsupported dataset '${kind}'. Supported datasets: quantized, smooth`);
  }
}

function printAverageAsciiChart(results: BenchmarkResult[]) {
  if (results.length === 0) return;

  const maxAvg = Math.max(...results.map((result) => result.avgMs));
  const chartWidth = 40;

  console.log("avg runtime chart (ms, lower is better)");

  for (const result of results) {
    const ratio = maxAvg > 0 ? result.avgMs / maxAvg : 0;
    const barLength = Math.max(1, Math.round(ratio * chartWidth));
    const bar = "#".repeat(barLength);
    console.log(
      `${result.contender.padEnd(12)} | ${bar.padEnd(chartWidth)} | ${result.avgMs.toFixed(3)}`,
    );
  }
}

function benchmark(contender: Contender, grid: number[][], levels: number[]) {
  const { runCore, summarize } = contender.setup(grid, levels);

  for (let i = 0; i < warmups; i++) {
    runCore();
  }

  forceGC();
  const memBefore = process.memoryUsage();

  const durations: number[] = [];
  let finalSummary: BenchSummary = {
    polylineCount: 0,
    pointCount: 0,
    invalidPointCount: 0,
    emptyPolylineCount: 0,
  };
  let sawInconsistentCounts = false;

  for (let i = 0; i < repeats; i++) {
    const t0 = performance.now();
    const output = runCore();
    const t1 = performance.now();

    const summary = summarize(output);

    durations.push(t1 - t0);

    if (
      i > 0 &&
      (summary.polylineCount !== finalSummary.polylineCount ||
        summary.pointCount !== finalSummary.pointCount)
    ) {
      sawInconsistentCounts = true;
    }

    finalSummary = summary;
  }

  forceGC();
  const memAfter = process.memoryUsage();

  const totalMs = durations.reduce((sum, value) => sum + value, 0);
  const avgMs = totalMs / durations.length;

  console.log(
    `${contender.name} => polylines=${finalSummary.polylineCount}, points=${finalSummary.pointCount}, runs=${durations.length}`,
  );

  if (contender.setupNotes) {
    console.log(`${contender.name} setup: ${contender.setupNotes}`);
  }

  if (finalSummary.invalidPointCount > 0 || finalSummary.emptyPolylineCount > 0) {
    console.log(
      `${contender.name} sanity: invalidPoints=${finalSummary.invalidPointCount} emptyPolylines=${finalSummary.emptyPolylineCount}`,
    );
  }

  if (sawInconsistentCounts) {
    console.log(
      `${contender.name} warning: contour counts changed across repeated runs; check for nondeterminism or unstable threshold tie behavior.`,
    );
  }

  // console.log(
  //   `${contender.name} timing ms: min=${Math.min(...durations).toFixed(3)} median=${median(durations).toFixed(3)} p95=${percentile(durations, 95).toFixed(3)} avg=${avgMs.toFixed(3)}`,
  // );

  // console.log(
  //   `${contender.name} memory MiB: heapUsed_before=${bytesToMiB(memBefore.heapUsed).toFixed(2)} heapUsed_after=${bytesToMiB(memAfter.heapUsed).toFixed(2)} rss_before=${bytesToMiB(memBefore.rss).toFixed(2)} rss_after=${bytesToMiB(memAfter.rss).toFixed(2)}`,
  // );

  return {
    contender: contender.name,
    avgMs,
    minMs: Math.min(...durations),
    medianMs: median(durations),
    p95Ms: percentile(durations, 95),
  } as BenchmarkResult;
}

const contenders: Contender[] = [
  {
    name: "efficient",
    setup: (grid, levels) => {
      return {
        runCore: () => marchingSquares(levels, grid),
        summarize: (output) => summarizePolylinesPacked(output as PolylinesWithLevels),
      };
    },
  },
  {
    name: "simple",
    setup: (grid, levels) => {
      return {
        runCore: () => marchingSquaresSimple(levels, grid),
        summarize: (output) => summarizePolylines(output as PointLine[]),
      };
    },
  },
  {
    name: "d3 1x",
    setup: (grid, levels) => {
      const { values, xDim, yDim } = flattenGridForD3(grid);
      const shiftedLevels = levels.map((level) => level + contourThresholdEpsilon);
      const generator = contours().size([xDim, yDim]).thresholds(shiftedLevels);
      const generateContours = (generator as D3ContoursWithSmooth).smooth(false);

      return {
        runCore: () => generateContours(values),
        summarize: (output) => summarizeD3Isolines(output as ContourMultiPolygon[]),
      };
    },
  },
  {
    name: "d3 2x",
    setup: (grid, levels) => {
      const { values, xDim, yDim } = flattenGridForD3(grid);
      const shiftedLevels = levels.map((level) => level + contourThresholdEpsilon);
      const generator = contours().size([xDim, yDim]).thresholds(shiftedLevels);
      const generateContours = (generator as D3ContoursWithSmooth).smooth(false);

      return {
        runCore: () => {
          generateContours(values);
          return generateContours(values);
        }, // run twice to simulate the fast-barnes-ts behaviour where it has to calculate a second set of contours to remove data void edges
        summarize: (output) => summarizeD3Isolines(output as ContourMultiPolygon[]),
      };
    },
    // setupNotes:
    //   "Core-only timing excludes one-time grid flattening and generator construction; d3 thresholds are shifted by BENCH_THRESHOLD_EPSILON to approximate strict > semantics and closed-ring duplicate endpoints are removed during summary.",
  },
];

console.log("Benchmark configuration");
console.log(
  `sizes=${sizes.join(",")}, thresholds=${thresholds.join(",")}, datasets=${datasets.join(",")}, warmups=${warmups}, repeats=${repeats}`,
);
console.log(
  `normalization: thresholdEpsilon=${contourThresholdEpsilon}, pointEpsilon=${pointEqualityEpsilon}`,
);
console.log("Use NODE_OPTIONS=--expose-gc to enable explicit GC between benchmark phases.");
console.log(
  "Core-only benchmark: setup/adapters and output normalization are excluded from timing; only contour generation is timed.",
);
console.log("");

if (thresholds.length === 0) {
  throw new Error(
    "No valid thresholds supplied. Set BENCH_THRESHOLDS to a comma-separated numeric list.",
  );
}

for (const dataset of datasets) {
  for (const size of sizes) {
    const griddedData = makeGrid(dataset, size);
    const benchmarkResults: BenchmarkResult[] = [];

    console.log(`Dataset=${dataset} Grid=${size}x${size}`);
    for (const contender of contenders) {
      benchmarkResults.push(benchmark(contender, griddedData, thresholds));
    }
    printAverageAsciiChart(benchmarkResults);
    console.log("");
  }
}
