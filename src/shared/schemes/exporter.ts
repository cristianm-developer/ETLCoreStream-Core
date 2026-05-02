import type { RowObject } from "./row-object";

export type Exporter = {
  name: string;
  description: string;
  fn: (row: RowObject) => any;
  labelDicc?: Record<string, string>;
  callback?: (stream: ReadableStream) => Promise<void>;
};
