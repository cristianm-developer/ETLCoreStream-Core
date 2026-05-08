import type { GlobalStepTransform } from "./global-step-transform";
import type { GlobalStepValidator } from "./global-step-validator";
import type { RowFilter } from "./persistent-filter";

export type GlobalStep = {
  name: string;
  description?: string;
  order: ("transforms" | "validators")[];
  reprocessAllRowsOnChange?: boolean;
  filter: {
    rows: RowFilter;
  };
  transforms?: GlobalStepTransform[];
  validators?: GlobalStepValidator[];
};
