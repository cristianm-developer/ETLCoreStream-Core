import type { GlobalStepTransform } from "./global-step-transform";
import type { GlobalStepValidator } from "./global-step-validator";
import type { ErrorFilter, RowFilter } from "./persistent-filter";

export type GlobalStep = {
  name: string;
  order: "transforms" | "validators"[];
  reprocessAllRowsOnChange: boolean;
  filter: {
    rows: RowFilter;
    errors: ErrorFilter;
  };
  transforms?: GlobalStepTransform[];
  validators?: GlobalStepValidator[];
};
