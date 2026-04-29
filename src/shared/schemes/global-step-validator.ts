import { ValidationError } from "./local-step-validators";
import { ErrorFilter, RowFilter } from "./persistent-filter";
import { RowObject } from "./row-object";


export type GlobalStepValidator = {
    headerKey: string;
    name: string;
    fn: (
        rows: RowObject[],
        ...args: any[]
    ) => Promise<{
        validationErrors: ValidationError[];
        removedValidationErrors: number[];
    }>;
    args?: any[];
}