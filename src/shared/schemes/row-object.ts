export type RowObject = {
  __rowId: number;
  __originalValue?: Record<string, any>;
  __isError?: string | null;
  value: Record<string, any>;
};
