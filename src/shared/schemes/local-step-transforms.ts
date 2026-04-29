
export type LocalStepTransform = {
    headerKey: string;
    name: string;
    fn: (
            value: string,
            row: any,
            ...args: any[]
        ) => string;
    args?: any[];
}