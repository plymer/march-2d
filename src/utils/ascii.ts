import type { Point } from "./types.js";

export const renderAsciiSegments = (
  segments: [[number, number], [number, number]][],
  gridXDim: number,
  gridYDim: number,
  scale = 2,
) => {
  const canvasWidth = (gridXDim - 1) * 2 * scale + 1;
  const canvasHeight = (gridYDim - 1) * scale + 1;

  const canvas: string[][] = Array.from({ length: canvasHeight }, () =>
    Array.from({ length: canvasWidth }, () => " "),
  );

  const plot = (x: number, y: number, ch: string) => {
    const cx = Math.round(x * 2 * scale);
    const cy = Math.round(y * scale);
    if (cx < 0 || cx >= canvasWidth || cy < 0 || cy >= canvasHeight) return;
    canvas[cy]![cx] = ch;
  };

  const drawSegment = (a: [number, number], b: [number, number]) => {
    const [x0, y0] = a;
    const [x1, y1] = b;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * scale));

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      plot(x, y, ".");
    }

    plot(x0, y0, "o");
    plot(x1, y1, "o");
  };

  for (const [p0, p1] of segments) drawSegment(p0, p1);

  const output = canvas.map((row) => row.join("")).join("\n");
  console.log("\nASCII isolines:\n");
  console.log(output);
};

export const renderAsciiPolylines = (
  polylines: Point[][],
  gridXDim: number,
  gridYDim: number,
  scale = 2,
) => {
  const pointsEqual = (a: Point, b: Point, eps = 1e-6) =>
    Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps;

  const width = (gridXDim - 1) * 2 * scale + 1;
  const height = (gridYDim - 1) * scale + 1;

  const canvas: string[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => " "),
  );

  const plot = (x: number, y: number, ch: string) => {
    const cx = Math.round(x * 2 * scale);
    const cy = Math.round(y * scale);
    if (cx < 0 || cx >= width || cy < 0 || cy >= height) return;
    canvas[cy]![cx] = ch;
  };

  const ANSI_RESET = "\x1b[0m";
  const ANSI_COLOUR = "\x1b[31m";
  const COLOUR_PLUS = `${ANSI_COLOUR}+${ANSI_RESET}`;

  for (let gy = 0; gy < gridYDim; gy++) {
    for (let gx = 0; gx < gridXDim; gx++) {
      plot(gx, gy, COLOUR_PLUS);
    }
  }

  const drawLine = (a: Point, b: Point, ch = ".") => {
    const [x0, y0] = a;
    const [x1, y1] = b;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * scale));

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      plot(x, y, ch);
    }
  };

  for (const line of polylines) {
    if (line.length < 2) continue;

    for (let i = 0; i < line.length - 1; i++) {
      if (line[i] === undefined || line[i + 1] === undefined) continue;
      drawLine(line[i]!, line[i + 1]!, ".");
    }

    const first = line[0]!;
    const last = line[line.length - 1]!;
    const isClosed = line.length > 2 && pointsEqual(first, last);

    if (isClosed) {
      // closed contour: mark one representative loop point
      plot(first[0], first[1], "x");
    } else {
      // open contour: mark both ends
      plot(first[0], first[1], "o");
      plot(last[0], last[1], "o");
    }
  }

  console.log("\nASCII polylines:\n");
  console.log(canvas.map((row) => row.join("")).join("\n"));
};
