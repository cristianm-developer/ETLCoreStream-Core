How to create local transforms

Local transforms are applied per cell during the local-step pipeline. Each transform:

- receives the cell value,
- receives the full row (so transforms can reference other fields),
- may receive `args` (dictionaries, predicates, or external config).

Contract

- The transform function (`fn`) MUST return the transformed value for that cell. Per the shared scheme, local transforms are expected to return a string (update the scheme if you need other types).
- Transforms should be pure and must not mutate the original `row` object; return a new value instead.
- Use the `args` property on the transform definition to pass dictionaries, predicate functions, or other static configuration; these args will be forwarded to `fn` when executed.
- Always defensively handle null/undefined values (e.g., `if (value == null) return value;`) before calling string helpers like `.trim()` or `.replace()`.

Examples (from repo)

Trim transform:

```6:10:src/examples/steps/local/transforms/local-transforms.ts
/**
 * Elimina espacios en blanco al inicio y final del valor
 */
export const trim = (headerKey: string): LocalStepTransform => ({
  headerKey,
  name: 'trim',
  fn: (value: string, _row: any, ...args: any[]) => {
    if (value == null) return value;
    return String(value).trim();
  },
});
```

Dictionary mapping transform (uses `args` to pass the mapping dict):

```15:26:src/examples/steps/local/transforms/local-transforms.ts
export const diccTransform = (
  headerKey: string,
  dict: Record<string, string>
): LocalStepTransform => ({
  headerKey,
  name: 'diccTransform',
  fn: (value: string, _row: any, ...args: any[]) => {
    const mappingDict: Record<string, string> = args[0] ?? {};
    if (value == null) return value;
    return mappingDict[String(value)] ?? value;
  },
  args: [dict],
});
```

Predicate-based transform (returns normalized boolean string):

```49:60:src/examples/steps/local/transforms/local-transforms.ts
export const boolResult = (
  headerKey: string,
  predicate: (value: string, row?: any) => boolean
): LocalStepTransform => ({
  headerKey,
  name: 'boolResult',
  fn: (value: string, row: any, ...args: any[]) => {
    const pred: (value: string, row?: any) => boolean = args[0] ?? (() => false);
    return pred(value, row) ? 'true' : 'false';
  },
  args: [predicate],
});
```

Best practices

- Always guard against null/undefined before using string helpers and convert values to string when appropriate.
- Prefer pure functions that return a new value and avoid mutating `row`.
- Use `args` to pass external dictionaries, lookup tables, or predicate functions; the engine will forward `transform.args` to your `fn`.
- Keep transforms small and composable — they are combined per `localStep` in layouts. Respect the `order` defined in `LayoutLocalStep`; transforms run in the sequence specified by that step's `order`.

Where to use

- Configure transforms in `localSteps` entries inside layout files (see `src/examples/layout/layout-example.ts`). The local-step engine applies transforms in the configured `order` before validators when appropriate.
