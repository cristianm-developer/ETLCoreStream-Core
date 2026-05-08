import {
  boolResult,
  clear,
  diccTransform,
  extractDigits,
  toLowerCase,
  toUpperCase,
  trim,
} from "./transforms/local-transforms";
import {
  inList,
  inRange,
  maxLength,
  maxValue,
  minLength,
  minValue,
  notEmpty,
  notNegative,
  notNull,
  onlyNumeric,
  regex,
} from "./validators/local-validators";

export const LocalStepFnsExample = {
  transforms: (headerKey: string) => {
    return {
      trim: () => trim(headerKey),
      toUpperCase: () => toUpperCase(headerKey),
      toLowerCase: () => toLowerCase(headerKey),
      extractDigits: () => extractDigits(headerKey),
      clear: () => clear(headerKey),
      boolResult: () => boolResult(headerKey, (value: string, row: any) => value === "true"),
      diccTransform: () => diccTransform(headerKey, { true: "1", false: "0" }),
    };
  },
  validators: (headerKey: string) => {
    return {
      notNull: () => notNull(headerKey),
      onlyNumeric: () => onlyNumeric(headerKey),
      regex: (regexPattern: string) => regex(headerKey, regexPattern),
      minLength: (minLengthValue: number) => minLength(headerKey, minLengthValue),
      maxLength: (maxLengthValue: number) => maxLength(headerKey, maxLengthValue),
      minValue: (minValueValue: number) => minValue(headerKey, minValueValue),
      maxValue: (maxValueValue: number) => maxValue(headerKey, maxValueValue),
      notEmpty: notEmpty(headerKey),
      inRange: (minValue: number, maxValue: number) => inRange(headerKey, minValue, maxValue),
      inList: (list: string[]) => inList(headerKey, list),
      notNegative: notNegative(headerKey),
    };
  },
};
