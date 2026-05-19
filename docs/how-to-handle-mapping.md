# How to handle Mapping

This document explains how the mapping module works and how to implement the remapping callback the runtime will call when it needs a user-provided mapping. The module surface is defined in `src/core/mapping/i-mapping-module.ts` and exposes the `RemapFn` type and `MappingModuleOptions` you should wire into the module.

Reference (interface and defaults):

```1:35:src/core/mapping/i-mapping-module.ts
import type { LayoutBase } from "@/shared/schemes/layout-base";
import type { LayoutHeader } from "@/shared/schemes/layout-header";
import type { Signal } from "@preact/signals-core";

export type RemapFn = (rowKeys: string[], headers: LayoutHeader[]) => Promise<[string, string][]>;

export type MappingModuleOptions = {
  allowRemapColumns: boolean;
  ignoreRemapUnrequired: boolean;
  restCount?: number;
  onRemapFn?: RemapFn;
  preserveOriginalValue: boolean;
};

export const DEFAULT_MAP_HEADERS_OPTIONS: MappingModuleOptions = {
  allowRemapColumns: false,
  ignoreRemapUnrequired: false,
  restCount: 10000,
  preserveOriginalValue: false,
};

export interface IMappingModule {
  progress: Signal<number | null>;
  handleStream: (
    stream: ReadableStream,
    layout: LayoutBase,
    totalRowEstimated: Signal<number | null>,
    signal?: AbortSignal,
    step?: string,
    order?: number
  ) => Promise<ReadableStream>;

  handleRemap: (layout: LayoutBase, row: any, signal?: AbortSignal) => Promise<[string, string][]>;
  updateOptions(options: Partial<MappingModuleOptions>): void;
}
```

Key concepts

- onRemapFn: Optional async callback you provide when the module needs a user-provided mapping. It receives:
  - `rowKeys: string[]` — keys found in the current incoming row.
  - `headers: LayoutHeader[]` — detected layout headers the system knows about.
    It must return a Promise resolving to an array of tuples `[sourceKey, targetKey]` describing how incoming keys map to internal header ids.

Implementing the remap callback (RemapFn)

The module calls a function matching `RemapFn` whenever it needs a mapping dictionary. The function must return a Promise that resolves to an array of tuples: `[incomingKey, targetHeaderId]`.

Note: each tuple follows the order `[originalKey, mappedHeaderId]` — the first element is the original key from the incoming row (incoming/original), and the second element is the internal header id the core should map that key to.

Below are two practical, non-React examples you can use as reference. The first is a simple heuristic auto-matcher; the second shows how to hook a programmatic prompt (Node CLI) when heuristics are ambiguous.

Heuristic auto-matcher

```javascript
// Simple heuristic: match incoming keys to headers by label (case-insensitive),
// fall back to returning the same key so the core can decide.
async function autoRemap(rowKeys, headers) {
  return rowKeys.map((rk) => {
    const match = headers.find((h) => {
      if (!h.label) return false;
      return String(h.label).trim().toLowerCase() === String(rk).trim().toLowerCase();
    });
    return [rk, match ? match.id : rk];
  });
}
```

Programmatic prompt (Node CLI) for ambiguous keys

```javascript
// This example uses Node's readline to ask the operator for mappings when
// heuristics didn't find an obvious match. It returns a Promise that resolves
// to the mapping pairs.
const readline = require("readline");

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(question, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
}

async function promptRemap(rowKeys, headers) {
  const heuristics = await autoRemap(rowKeys, headers);
  const result = [];

  for (let i = 0; i < rowKeys.length; i++) {
    const [rk, mapped] = heuristics[i];
    if (mapped !== rk) {
      result.push([rk, mapped]);
      continue;
    }

    // Ask operator to choose a header id or accept the incoming key
    const headerList = headers.map((h) => `${h.id}:${h.label}`).join(", ");
    const answer = await ask(
      `Map incoming key "${rk}" — available headers: ${headerList}\nEnter header id (or blank to keep "${rk}"): `
    );
    result.push([rk, answer ? answer.trim() : rk]);
  }

  return result;
}
```

Where this plugs in

- The mapping module exposes `handleStream(...)` and `handleRemap(...)` on the `IMappingModule` interface. `handleStream` is the streaming entry point; `handleRemap` can be used to trigger a remap for a single row/layout when needed.

Practical recommendations

- Provide a robust `onRemapFn` that can do best-effort auto-matching (by label, case-insensitive keys, or heuristics) and fall back to a prompt for ambiguous cases.
- If you expect operators to want to see the raw input, enable `preserveOriginalValue` so exports or item rows can reference the original text.
- Start with `restCount` lower (e.g., 1000) during development or interactive demos, then raise it for large batch processing.
- Use `allowRemapColumns` to gate remapping behavior in automated pipelines — set to false when you want strict header enforcement.
- Set `ignoreRemapUnrequired` to true if you want the mapping to stay silent unless something clearly fails validation.

Programmatic wiring (non-React)

```javascript
// Acquire the mapping module from the provider (example API — adapt to your app)
// const mappingModule = provider.getModule('mapper');

// Set options with your RemapFn implementation
mappingModule.updateOptions({
  allowRemapColumns: true,
  onRemapFn: promptRemap, // or autoRemap
  preserveOriginalValue: true,
  restCount: 2000,
});

// When streaming, the module will call your RemapFn as needed.
// You can also remap a single row manually:
// const manualMap = await mappingModule.handleRemap(layout, someRow);
```

That's it — supply `onRemapFn` (a `RemapFn`) to control the mapping dictionary, let `allowRemapColumns` gate whether remapping is attempted at all, use `ignoreRemapUnrequired` to skip prompts when input already satisfies requirements, enable `preserveOriginalValue` when the raw cell should be kept, and tune `restCount` for chunk/yield behavior.
