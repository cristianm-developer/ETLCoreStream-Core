import type { RowObject } from "./row-object";

export type Exporter = {
  name: string;
  description?: string;
  label?: string;
  fn: (row: RowObject) => Record<string, any>;
  labelDicc?: Record<string, string>;
  callback?: (stream: ReadableStream) => Promise<void>;
};
