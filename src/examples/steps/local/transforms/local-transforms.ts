import type { LocalStepTransform } from "@/shared/schemes/local-step-transforms";

/**
 * Elimina espacios en blanco al inicio y final del valor
 */
export const trim = (headerKey: string): LocalStepTransform => ({
  headerKey,
  name: "trim",
  fn: (value: string, _row: any, ..._args: any[]) => value.trim(),
});

/**
 * Transforma un valor usando un diccionario de mapeo
 */
export const diccTransform = (
  headerKey: string,
  dict: Record<string, string>
): LocalStepTransform => ({
  headerKey,
  name: "diccTransform",
  fn: (value: string, _row: any, ...args: any[]) => {
    const mappingDict: Record<string, string> = args[0] ?? {};
    return mappingDict[value] ?? value;
  },
  args: [dict],
});

/**
 * Extrae solo los dígitos del valor
 */
export const extractDigits = (headerKey: string): LocalStepTransform => ({
  headerKey,
  name: "extractDigits",
  fn: (value: string, _row: any, ..._args: any[]) => value.replace(/\D/g, ""),
});

/**
 * Limpia el valor convirtiéndolo en una cadena vacía
 */
export const clear = (headerKey: string): LocalStepTransform => ({
  headerKey,
  name: "clear",
  fn: (_value: string, _row: any, ..._args: any[]) => "",
});

/**
 * Convierte el valor a booleano basado en un predicado
 */
export const boolResult = (
  headerKey: string,
  predicate: (value: string, row?: any) => boolean
): LocalStepTransform => ({
  headerKey,
  name: "boolResult",
  fn: (value: string, row: any, ...args: any[]) => {
    const pred: (value: string, row?: any) => boolean = args[0] ?? (() => false);
    return pred(value, row) ? "true" : "false";
  },
  args: [predicate],
});
