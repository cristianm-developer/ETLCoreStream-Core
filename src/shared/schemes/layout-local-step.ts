import type { LocalStepTransform } from "./local-step-transforms";
import type { LocalStepValidator } from "./local-step-validators";

export type LayoutLocalStep = {
  id: string;
  name: string;
  description: string;
  order: "transforms" | "validators"[];
  transforms?: LocalStepTransform[];
  validators?: LocalStepValidator[];
};
