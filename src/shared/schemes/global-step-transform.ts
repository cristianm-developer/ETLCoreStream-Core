import type { RowObject } from "./row-object";

export type GlobalStepTransform = {
  headerKey: string;
  name: string;
  fn: (rows: RowObject[], ...args: any[]) => Promise<void>;
  args?: any[];
};
