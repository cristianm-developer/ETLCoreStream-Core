import { GlobalStepTransform } from "./global-step-transform";
import { GlobalStepValidator } from "./global-step-validator";
import { ValidationError } from "./local-step-validators";
import { ErrorFilter, RowFilter } from "./persistent-filter";
import { RowObject } from "./row-object";

export type GlobalStep = {
    name: string;
    order: 'transforms' | 'validators'[];    
    reprocessAllRowsOnChange: boolean;    
    filter: {
        rows: RowFilter;
        errors: ErrorFilter;
    }
    transforms?: GlobalStepTransform[];
    validators?: GlobalStepValidator[];
}