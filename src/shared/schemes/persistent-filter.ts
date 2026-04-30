export type ErrorFilter = {
  fromRowId?: number;
  toRowId?: number;
  rowIdIn?: number[];
};

export type RowFilter = {
  withErrors?: boolean;
  withoutErrors?: boolean;
  fields?: RowFilteredField[];
} & ErrorFilter;

export type RowFilteredField = {
  headerKey: string;
  operator:
    | "="
    | "!="
    | ">"
    | "<"
    | ">="
    | "<="
    | "includes"
    | "notIncludes"
    | "startsWith"
    | "endsWith"
    | "isEmpty"
    | "isNotEmpty"
    | "regex"
    | "notRegex"
    | "isTrue"
    | "isFalse"
    | "isNotNull"
    | "isNullish"
    | "isDefined"
    | "isNumber";
  value: any;
};
