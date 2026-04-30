# How to handle Mapping

This document explains how the mapping module works and the options you can pass to control remapping behavior. The runtime exposes an interface and options in `src/core/mapping/i-mapping-module.ts` that the core mapping flow uses.

Reference (options and defaults):

```5:18:e:/Developing/Web/Personal/Components/ETL CoreStream/src/core/mapping/i-mapping-module.ts
export type MappingModuleOptions = {
    allowRemapColumns: boolean;
    ignoreRemapUnrequired: boolean;
    restCount?: number;
    onRemapFn?: (rowKeys: string[], headers: LayoutHeader[]) => Promise<[string, string][]>;
    preserveOriginalValue: boolean;
}

export const DEFAULT_MAP_HEADERS_OPTIONS: MappingModuleOptions = {
    allowRemapColumns: false,
    ignoreRemapUnrequired: false,
    restCount: 10000,
    preserveOriginalValue: false,
}
```

Key concepts

- onRemapFn: Optional async callback you provide when the module needs a user-provided mapping. It receives:
  - `rowKeys: string[]` — keys found in the current incoming row.
  - `headers: LayoutHeader[]` — detected layout headers the system knows about.
    It must return a Promise resolving to an array of tuples `[sourceKey, targetKey]` describing how incoming keys map to internal header ids.

Example onRemapFn:

```typescript
async function askUserForMap(rowKeys: string[], headers: LayoutHeader[]) {
  // Example: match by name or ask UI. Return pairs [incomingKey, headerId]
  return rowKeys.map((rk) => {
    const match = headers.find((h) => h.label?.toLowerCase() === rk.toLowerCase());
    return [rk, match ? match.id : rk]; // fallback to same key if unsure
  }) as [string, string][];
}
```

- allowRemapColumns (boolean): When true, the mapping flow will allow/attempt remapping of columns. If false, remapping is skipped and headers are applied as-is.

- ignoreRemapUnrequired (boolean): When true the module will skip prompting/asking for remap if the input already meets the minimum requirements for headers. If the input does not meet the minimum (missing required headers or obvious mismatches), it will invoke `onRemapFn` (or other remap UI) to request a mapping.

- preserveOriginalValue (boolean): When enabled the module keeps the original cell value alongside the remapped/normalized value so downstream steps or exports can display or use both. Use this when you want to show the raw input in the item row or keep it for auditing.

- restCount (number, optional): Controls chunking/pausing frequency — the core yields (pauses to flush or allow UI updates) after roughly `restCount` processed rows. The default in the codebase is 10000; tune this lower for interactive flows or larger for throughput.

Where this plugs in

- The mapping module exposes `handleStream(...)` and `handleRemap(...)` on the `IMappingModule` interface. `handleStream` is the streaming entry point; `handleRemap` can be used to trigger a remap for a single row/layout when needed.

Practical recommendations

- Provide a robust `onRemapFn` that can do best-effort auto-matching (by label, case-insensitive keys, or heuristics) and fall back to a UI prompt for ambiguous cases.
- If you expect users to want to see the raw input, enable `preserveOriginalValue` so exports or item rows can reference the original text.
- Start with `restCount` lower (e.g., 1000) during development or interactive demos, then raise it for large batch processing.
- Use `allowRemapColumns` to gate remapping behavior in automated pipelines — set to false when you want strict header enforcement.
- Set `ignoreRemapUnrequired` to true if you want the mapping to stay silent unless something clearly fails validation.

Example: wiring options into a mapping invocation

```typescript
const mappingOptions: MappingModuleOptions = {
  allowRemapColumns: true,
  ignoreRemapUnrequired: false,
  restCount: 2000,
  onRemapFn: askUserForMap,
  preserveOriginalValue: true,
};

const outStream = await mappingModule.handleStream(
  inStream,
  layout,
  estimatedTotal,
  abortSignal,
  "map-step",
  0
);
```

That's it — supply `onRemapFn` to control the mapping dictionary, toggle `allowRemapColumns` / `ignoreRemapUnrequired` to control when remap prompts happen, use `preserveOriginalValue` if you need the raw input preserved, and tune `restCount` for chunk/yield behavior.
