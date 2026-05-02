export type RowObject = {
  __rowId: number;
  __originalValue?: string;
  __isError?: string | null;
  value: Record<string, any>;
};
