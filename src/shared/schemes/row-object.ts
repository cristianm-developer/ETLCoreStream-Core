

export type RowObject = {
    __rowId: number;
    __originalValue?: string;
    __sError?: string | null;
    value: Record<string, any>;
}