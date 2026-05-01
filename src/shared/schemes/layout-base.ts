import type { Exporter } from "./exporter";
import type { GlobalStep } from "./layout-global-step";
import type { LayoutHeader } from "./layout-header";
import type { LayoutLocalStep } from "./layout-local-step";

export type LayoutBase = {
  id: string;
  name: string;
  description: string;
  allowUndefinedColumns: boolean;
  headers: LayoutHeader[];
  localSteps: LayoutLocalStep[];
  globalSteps: GlobalStep[];
  exports: Exporter[];
};
