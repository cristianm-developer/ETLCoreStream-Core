# How to create a global transform

Global transforms run on chunks of rows (an array of `RowObject`) and are invoked once per chunk during the global step phase. Use them for bulk enrichment, batched lookups, and operations that must consider multiple rows together.

Important rules

- Signature: `fn(rows: RowObject[], ...args: any[])` — the function receives the chunk and optional `args`.
- Chunking: the transform is called once for each chunk of the dataset. Do not assume `rows` contains the entire file — it contains only the current chunk.
- Row mutation: global transforms may update `row.value[...]` in-place (many examples in this repo mutate rows directly). If your transform returns data instead of mutating, follow the shared scheme contract.
- Performance: avoid calling external APIs per-row. Instead gather inputs from the chunk, perform one bulk call, then map responses back to rows (use a Map keyed by `__rowId`).
- State across chunks: to maintain accumulators, caches, or counters across chunks, pass an object via `args` (e.g., `{ cache: new Map(), counters: {} }`). This allows cross-chunk context without global variables.
- Idempotence: design transforms so repeated runs or retries won't produce incorrect results.

Example (implementation in this repo):

```6:21:src/examples/steps/global/transforms/global-transforms.ts
export const AsyncTransformDataExample = (): GlobalStepTransform => ({
    name: 'AsyncTransformDataExample',
    fn: async (rows: RowObject[], ...args: any[]) => {

        const itemsExtracted = rows.map(row => ({id: row.__rowId, value: row.value['headerKey']}));
        const transformedItems = await transformDataExample(itemsExtracted);
        const rowMap = new Map(rows.map(r => [r.__rowId, r]));

        transformedItems.forEach(item => {
            const row = rowMap.get(item.id);
            if (row) {
                row.value['headerKey'] = item.value;
            }
        });
    }
})
```

Best practices

- Batch remote calls per-chunk; if you need to check 100s of values, send them in one request.
- Cache frequent lookups in an `args` cache to reduce repeated network/DB cost.
- Keep transform functions async and non-blocking; move heavy CPU work into workers if available.

Where to register

- Export the transform and add it to your layout or provider global steps configuration so the orchestrator runs it during the global phase.
