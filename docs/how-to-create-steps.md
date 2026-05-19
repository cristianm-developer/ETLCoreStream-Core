# How to create Steps (local & global)

This document describes the current shape and usage for Local and Global steps in a layout. Steps group validation and transform logic into stages. Each layout can contain multiple local steps and multiple global steps. See the example layout at `src/examples/layout/layout-example.ts`.

Key points

- A "step" bundles transforms and validators for a single stage.
- `order` is an array that controls the execution groups sequence (e.g. `["transforms","validators"]`).
- A step can include multiple transforms and multiple validators.
- Local steps run row-by-row (streaming style). Global steps run after streaming, in chunks, and may query external/context data.

Layout step types

Local step shape

Refer to the Local step type:

```11:41:src/shared/schemes/layout-local-step.ts
export type LayoutLocalStep = {
  id: string;
  name: string;
  description?: string;
  order: ("transforms" | "validators")[];
  transforms?: LocalStepTransform[];
  validators?: LocalStepValidator[];
};
```

How local steps work

- Local steps are executed sequentially for each row. Each row flows through the layout's `localSteps` in order.
- `order` is an array of group names; the engine runs groups in the listed sequence (e.g. `["transforms","validators"]`).
- Transforms should perform pure transformations; validators should inspect and return validation results (no side effects).
- When a row is edited it is reprocessed through all local steps so transforms and validators produce consistent output.

Example (local step in the example layout):

```48:56:src/examples/layout/layout-example.ts
    {
      id: "name-processing",
      name: "Name Processing",
      description: "Cleaning and normalization of the name field",
      order: ["transforms", "validators"] as any,
      transforms: [],
      validators: [],
    },
```

Global step shape

Refer to the Global step type:

```12:47:src/shared/schemes/layout-global-step.ts
export type GlobalStep = {
  name: string;
  description?: string;
  order: ("transforms" | "validators")[];
  reprocessAllRowsOnChange?: boolean;
  filter: {
    rows: RowFilter;
  };
  transforms?: GlobalStepTransform[];
  validators?: GlobalStepValidator[];
};
```

How global steps work

- Global steps run after local/stream processing as end-of-processing stages over matching rows (chunks).
- Each global step can apply a row filter so it only runs on a subset of rows, and may use external/context data to perform validations or transforms.
- `reprocessAllRowsOnChange` (when true) signals that changes in the global step's data should trigger reprocessing of all rows.
- Be cautious with chunk sizes and external queries to avoid performance/memory issues.

Example (global step in the example layout):

```68:76:src/examples/layout/layout-example.ts
    {
      description: "Global validation step",
      name: "Global Validation Step",
      order: ["validators"],
      reprocessAllRowsOnChange: true,
      filter: {
        rows: { withErrors: false },
      },
      validators: [],
    },
```

Design notes & best practices

- Keep steps small and focused (one responsibility per step).
- Use `order` to ensure necessary normalizations happen before validations.
- Prefer local steps for synchronous per-row normalization and checks.
- Use global steps for enrichment, lookups, cross-row validations, or when validators need aggregated/external data.

Troubleshooting

- If local edits are not applied, verify `localSteps` presence and that edited rows are replayed through the pipeline.
- If global validations look stale, verify filters and `reprocessAllRowsOnChange`, and that any external queries return expected results.

Additional references

- Example layout: `src/examples/layout/layout-example.ts`

If you'd like, I can also add a one-line template you can paste when creating a new step or a short checklist for implementing steps.
