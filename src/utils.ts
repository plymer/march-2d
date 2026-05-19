export function applyThreshold(grid: number[][], threshold: number) {
  const yDim = grid.length;
  const xDim = grid[0]?.length;

  const outputGrid: number[][] = [];

  if (xDim === 0 || xDim === undefined || yDim === 0 || yDim === undefined)
    throw new Error(" Grid input is invalid");

  for (let y = 0; y < yDim; y++) {
    outputGrid.push([]);
    for (let x = 0; x < xDim; x++) {
      if (grid[y]?.[x] === undefined) throw new Error("Gridpoint in grid is undefined");
      outputGrid[y]?.push(grid[y]![x]! >= threshold ? 1 : 0);
    }
  }

  return outputGrid;
}

export function marchGrid(inputGrid: number[][]) {
  const inputYDim = inputGrid.length;
  const inputXDim = inputGrid[0]?.length;

  if (inputXDim === 0 || inputXDim === undefined || inputYDim === 0 || inputYDim === undefined)
    throw new Error(" Grid input is invalid");

  const outputYDim = inputYDim - 1;
  const outputXDim = inputXDim - 1;

  const outputGrid: number[][] = [];

  for (let y = 0; y < outputYDim; y++) {
    outputGrid.push([]);
    for (let x = 0; x < outputXDim; x++) {
      // y is the row
      // x is the column
      const topLeft = inputGrid[y]![x];
      const topRight = inputGrid[y]![x + 1];
      const bottomRight = inputGrid[y + 1]![x + 1];
      const bottomLeft = inputGrid[y + 1]![x];

      outputGrid[y]?.push(Number(`0b${topLeft}${topRight}${bottomRight}${bottomLeft}`));
    }
  }

  return outputGrid;
}
