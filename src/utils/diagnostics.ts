import type { Point } from "./types.js";

export function reportPolylineLengths(polylines: Point[][]) {
  console.log("polyline count", polylines.length);
  for (let i = 0; i < 20; i++) {
    console.log(
      "Polylines of length",
      i,
      ":",
      polylines.filter((line) => line.length === i).length,
    );
  }
}

export function reportJunctions(adjacency: Map<string, number[]>) {
  const degrees = Array.from(adjacency.entries()).reduce(
    (acc, [_, segs]) => {
      if (segs.length === 1) acc.degOne++;
      else if (segs.length === 2) acc.degTwo++;
      else if (segs.length === 3) acc.degThree++;
      else if (segs.length >= 4) acc.degFourPlus++;

      return acc;
    },
    { degOne: 0, degTwo: 0, degThree: 0, degFourPlus: 0 },
  );

  console.log("Junction degree counts:", degrees);
  reportComplexJunctions(adjacency);
}

function reportComplexJunctions(adjacency: Map<string, number[]>) {
  for (const [k, segs] of adjacency.entries()) {
    if (segs.length > 2) {
      console.log("junction", k, "degree", segs.length, "segments", segs);
    }
  }
}
