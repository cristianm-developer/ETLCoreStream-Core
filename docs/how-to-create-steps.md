# How to create Steps (local & global)

This document describes how to define and use Local and Global steps in a layout. Steps group validation and transform logic into stages. Each layout can contain multiple local steps and multiple global steps. Use the examples in `src/examples/layout/layout-example.ts` as a reference implementation.

Key points

- A "step" bundles transforms and validators for a single stage.
- The `order` field controls whether transforms run before validators or vice-versa.
- A stage can include multiple validators and multiple transforms.
- Local steps run sequentially per-row (streamed). Global steps run at the end (chunked) and can query external data.

Layout step types

Local step shape

See the Local step type:

```5:11:src/shared/schemes/layout-local-step.ts
export type LayoutLocalStep = {
    id: string;
    name: string;
    description: string;
    order: 'transforms' | 'validators'[];
    transforms?: LocalStepTransform[];
    validators?: LocalStepValidator[];
}
```

How local steps work

- Local steps are executed sequentially, row-by-row. Each row is passed through the layout's `localSteps` in order.
- Within a single local step the runtime follows the `order` array: if `['transforms','validators']` then transforms run first, then validators.
- All configured transforms and validators in that step are executed (there can be many).
- When a row is edited, it will flow again through all local steps to re-validate and re-transform consistently.

Example (from layout example — local steps):

```71:79:src/examples/layout/layout-example.ts
  localSteps: [
    {
      id: 'name-processing',
      name: 'Name Processing',
      description: 'Clean, trim, and validate name field',
      order: ['transforms', 'validators'],
      transforms: [trim('name')],
      validators: [minLength('name', 2), maxLength('name', 100)],
    },
```

Global step shape

See the Global step type:

```7:16:src/shared/schemes/layout-global-step.ts
export type GlobalStep = {
    name: string;
    order: 'transforms' | 'validators'[];
    reprocessAllRowsOnChange: boolean;
    filter: {
        rows: RowFilter;
        errors: ErrorFilter;
    }
    transforms?: GlobalStepTransform[];
    validators?: GlobalStepValidator[];
}
```

How global steps work

- Global steps are executed after the streaming/local processing phase — they run as "end of processing" stages over the dataset.
- Global steps operate in chunks (not per-row in a streaming sense). For each chunk the step can:
  - apply a row filter (e.g., only rows where `phone` is not null or `age > 18`), and
  - apply error filters so the step targets only rows with specific error conditions.
- The engine will perform the necessary queries (one per step or per chunk depending on implementation) to fetch external/context data used by that step. The query results feed the step's validators/transforms.
- `reprocessAllRowsOnChange` controls whether a change in that global step's data should cause reprocessing of all rows (useful when a global lookup changes).

Example (from layout example — global steps and filter):

```118:127:src/examples/layout/layout-example.ts
  globalSteps: [
    {
      name: 'Global Validation Step',
      order: ['validators'],
      reprocessAllRowsOnChange: true,
      filter: {
        rows: { withErrors: false },
        errors: {},
      },
      validators: [AsyncValidateDataExample()],
    },
```

Design notes & best practices

- Prefer small, focused steps: keep each step responsible for a cohesive piece of logic (e.g., "normalize country", "validate email format").
- Use `order` to avoid running expensive validations before cheap, necessary transforms that normalize data (trim, extract digits, map dictionaries).
- Local steps are ideal for per-row normalization and fast synchronous checks.
- Global steps are ideal for lookups, enrichment, cross-row validations, or any validation/transform that needs aggregated or external data.
- When writing global validators/transforms be mindful of chunk sizes and filters to avoid unnecessary queries and keep memory/performance bounded.
- If your global step depends on an external dataset that updates independently, set `reprocessAllRowsOnChange` thoughtfully.

Troubleshooting

- If edits are not reflected, ensure local steps are wired and the pipeline replays edited rows through all local steps.
- If global validations seem stale, verify filters and `reprocessAllRowsOnChange` settings and that the global query returns expected results.

Additional references

- Example layout with several local and global steps:

```118:139:src/examples/layout/layout-example.ts
  globalSteps: [
    {
      name: 'Global Validation Step',
      order: ['validators'],
      reprocessAllRowsOnChange: true,
      filter: {
        rows: { withErrors: false },
        errors: {},
      },
      validators: [AsyncValidateDataExample()],
    },
    {
      name: 'Global Transform Step',
      order: ['transforms'],
      reprocessAllRowsOnChange: false,
      filter: {
        rows: { withErrors: false },
        errors: {},
      },
      transforms: [AsyncTransformDataExample()],
    },
  ] as GlobalStep[],
```

If you want, I can add a short template snippet you can paste into a new layout or add a checklist for implementing a new step.
