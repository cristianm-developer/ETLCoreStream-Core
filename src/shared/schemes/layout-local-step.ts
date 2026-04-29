import { LocalStepTransform } from "./local-step-transforms";
import { LocalStepValidator } from "./local-step-validators";


export type LayoutLocalStep = {
    id: string;
    name: string;
    description: string;
    order: 'transforms' | 'validators'[];
    transforms?: LocalStepTransform[];
    validators?: LocalStepValidator[];
}