# How to create a layout (layout-base)

This document explains the contract and recommended processing flow for a layout definition file. The source of truth for the shape is `src/shared/schemes/layout-base.ts` — read that file first and use the example at `src/examples/layout/layout-example.ts` as a concrete reference.

Reference: layout shape (source of truth)

```1:17:e:/Developing/Web/Personal/Components/ETL CoreStream/src/shared/schemes/layout-base.ts
import { GlobalStep } from "./layout-global-step";
import { LayoutHeader } from "./layout-header";
import { LayoutLocalStep } from "./layout-local-step";
import { RowObject } from "./row-object";

export type LayoutBase = {
    id: string;
    name: string;
    description: string;
    allowUndefinedColumns: boolean;
    headers: LayoutHeader[];
    localSteps: LayoutLocalStep[];
    globalSteps: GlobalStep[];
    exports: Record<string, {fn: (row: RowObject) => any, labelDicc?: Record<string, string>, callback?: (stream: ReadableStream) => Promise<void>}>


}
```

Example layout (use as reference implementation)

```1:118:e:/Developing/Web/Personal/Components/ETL CoreStream/src/examples/layout/layout-example.ts
// Example layout based on the existing schemes in `src/shared/schemes/*`
// This file is a data-only reference (no imports or explicit types) that follows
// the shape expected by `LayoutBase`, `LayoutHeader`, `LayoutLocalStep` and `GlobalStep`.
...
export const LayoutExample: LayoutBase = {
  id: 'contact-management-layout-v1',
  name: 'Contact Management Layout',
  description: 'Example layout for processing contact information',
  allowUndefinedColumns: false,
  // ... (see file for full example)
};
```

What a layout describes

- Metadata: `id`, `name`, `description`.
- Column behavior: `allowUndefinedColumns` controls whether incoming rows may include columns not defined in `headers`.
- Headers: `headers` is the canonical column schema (key, label, alternativeKeys, required, default, order, etc.). Use this to map incoming file columns to the internal model.
- Local steps: `localSteps` are per-row operations (transforms, validators) applied to specific fields or groups.
- Global steps: `globalSteps` run across rows (filters, cross-row validators, batch transforms) and may reprocess rows when configuration changes.
- Exports: `exports` contains named export functions that map a processed row to an output object, plus optional label dictionaries and stream callbacks.

Recommended processing flow

1. Load the layout and validate it against `LayoutBase` (types/interfaces).
2. Build a header mapping:
   - For each header, register `key` and `alternativeKeys`.
   - Respect `caseSensitive` when matching incoming column names.
   - If a required header is missing in input, mark row-level error or apply `default`.
3. Parse incoming file rows into RowObject entries linking column keys to values.
4. For each row:
   - Apply `localSteps` in the order defined by each step's `order` (usually transforms then validators).
   - For each transform, mutate or add fields; for validators, collect errors and attach to the row.
5. After per-row processing, run `globalSteps`:
   - Apply filters, global validators, or batch transforms.
   - If a global step sets `reprocessAllRowsOnChange`, re-run affected local steps as needed.
6. Produce exports:
   - For each entry in `exports`, call `fn(row)` to generate the export object.
   - Use `labelDicc` to render column labels in UIs or exported files.
   - If `callback` is provided, use it to stream results (e.g., write CSV, upload).

Best practices and notes

- Keep layout files data-only (no runtime side-effects). Use the example file as the canonical pattern.
- Prefer explicit `alternativeKeys` rather than relying on fuzzy matching.
- Use `allowUndefinedColumns: false` for strict schemas; set to `true` only when you need to preserve unknown columns.
- Keep `localSteps` focused and small (one transform/validator purpose each). Order matters.
- Document export shapes (what `fn` returns) via `labelDicc` to improve UX and downstream integrations.
- When changing global validators or transformations that affect column semantics, increment layout `id` or version to force safe reprocessing.

Troubleshooting

- If columns are not matched: check `caseSensitive` and `alternativeKeys`.
- If rows unexpectedly re-run: check `reprocessAllRowsOnChange` in `globalSteps`.
- For performance issues on large datasets, batch global transforms and prefer streaming `callback` exports.

See the example in `src/examples/layout/layout-example.ts` for a full, annotated layout you can copy and adapt.
