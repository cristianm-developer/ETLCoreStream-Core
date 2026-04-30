import type { GlobalStep } from "./layout-global-step";
import type { LayoutHeader } from "./layout-header";
import type { LayoutLocalStep } from "./layout-local-step";
import type { RowObject } from "./row-object";

export type LayoutBase = {
  id: string;
  name: string;
  description: string;
  allowUndefinedColumns: boolean;
  headers: LayoutHeader[];
  localSteps: LayoutLocalStep[];
  globalSteps: GlobalStep[];
  exports: Record<
    string,
    {
      fn: (row: RowObject) => any;
      labelDicc?: Record<string, string>;
      callback?: (stream: ReadableStream) => Promise<void>;
    }
  >;
};
