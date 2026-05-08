import type { RowObject } from "./row-object";

export type GlobalStepTransform = {
  name: string;
  fn: (rows: RowObject[], ...args: any[]) => Promise<void>;
  args?: any[];
};
