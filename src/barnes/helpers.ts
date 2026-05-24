import type { Tuple2DWithValue } from "@plymer/fast-barnes-ts";
import fs from "fs/promises";
import path from "path";

export async function readInputFromCsv(): Promise<Tuple2DWithValue[]> {
  const csv = await fs.readFile(path.resolve(".", "src", "barnes", "input.csv"), "utf-8");

  const lines = csv.trim().split("\n");
  const pointData = lines.map((line) => {
    const [xStr, yStr, valueStr] = line.split(",");

    if (xStr === undefined || yStr === undefined || valueStr === undefined) {
      throw new Error(`Invalid CSV line: ${line}`);
    }
    return [
      Number.parseFloat(xStr),
      Number.parseFloat(yStr),
      Number.parseFloat(valueStr),
    ] as Tuple2DWithValue;
  });

  return pointData;
}
