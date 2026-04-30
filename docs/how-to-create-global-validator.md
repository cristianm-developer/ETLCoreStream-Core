# How to create a global validator

Global validators evaluate a chunk of rows at once and should return validation results for the rows in that chunk. They are ideal for checks that require comparing many rows, de-duplication, or batch calls to external systems.

Important rules

- Signature: `fn(rows: RowObject[], ...args: any[])` — receives a chunk and optional `args`.
- Return shape: return either a list of validation results or an object like `{ validationErrors, removedValidationErrors }` where `validationErrors` contains `ValidationError` entries referencing `__rowId`.
- Chunking: the validator runs once per chunk. Do not assume you have the whole dataset in `rows`.
- Avoid per-row external calls: batch inputs from the chunk, perform a single API/DB call, and map responses back to rows.
- Use `args` for caches, dictionaries, accumulators, or helper functions that persist across chunks.
- Validators should be side-effect free with respect to row shape — they report errors rather than mutating row values.

Example (implementation in this repo):

```6:26:src/examples/steps/global/validators/global-validators.ts
export const AsyncValidateDataExample = (): GlobalStepValidator => ({
    headerKey: 'headerKey',
    name: 'AsyncValidateDataExample',
    fn: async (rows: RowObject[], ...args: any[]) => {
        const validationResults = await validateDataExample(
            rows.map(row => ({ id: row.__rowId, value: row.value['headerKey'], row }))
        );

        const validationErrors: ValidationError[] = validationResults
            .filter(result => !result.isValid)
            .map(result => ({
                __rowId: result.id,
                headerKey: 'headerKey',
                validationCode: result.validationCode,
                message: result.message || 'Error de validación',
                value: result.value,
                originalValue: result.originalValue,
                step: 'AsyncValidateDataExample'
            }));

        return { validationErrors, removedValidationErrors: [] };
    }
});
```

Best practices

- Aggregate values per-chunk and validate them in bulk (single API or DB query).
- Use caches or dictionaries passed in `args` to avoid re-checking the same values across chunks.
- Provide clear `validationCode` and `message` so UI and automation can react.

Where to register

- Export the validator and add it to your layout's `globalSteps` so the orchestrator runs it during the global validation phase.
