export type DeepTypeValue<T> = T extends string
  ? T
  : T extends object
    ? DeepTypeValue<T[keyof T]>
    : never;

export type Flatten<T> = T extends string ? T : never;
