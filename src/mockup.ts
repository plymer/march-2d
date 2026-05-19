export function fillGrid(xDim: number, yDim: number) {
  const newGrid: number[][] = [];

  // now loop over and assign a value to each cell that we can contour
  for (let x = 0; x < xDim; x++) {
    newGrid.push([]);
    for (let y = 0; y < yDim; y++) {
      const value = Math.abs(Math.round(Math.sin(y)) + Math.round(Math.cos(x)));

      newGrid[x]?.push(value);
    }
  }

  return newGrid;
}
