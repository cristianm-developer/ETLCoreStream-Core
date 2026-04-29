export type LocalStepValidator = {
    headerKey: string;
    name: string;
    fn: (
        value: string,
        row: any,
        ...args: any[]
    ) => {
        isValid: boolean;
        validationCode: string;
        message?: string;
        value?: any;
        step: string;
    };
    args?: any[];
}


export type ValidationError = {
    __rowId: number;
    headerKey: string;
    validationCode: string;
    message?: string;
    value?: string;
    originalValue?: string;
    step: string;
}