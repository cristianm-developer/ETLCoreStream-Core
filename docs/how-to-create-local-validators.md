# How to create local validators

Local validators run during the local-step phase and are executed per cell (header) for every row. They receive:

- the cell value,
- the full row object (so you can compare other fields),
- optional factory args (for external rules/dictionaries).

Contract

- Must return an object containing at least:
  - `isValid: boolean`
  - optionally: `validationCode`, `message`, `value`, `step`
- Should be side-effect free (do not mutate the row).
- Must defensively check inputs (null/undefined) to avoid runtime errors.

Factory pattern

- Validators are usually implemented as factory functions that accept `headerKey` and optional params, returning a `LocalStepValidator`.

Examples (from repo)

Not-null validator:

```3:16:src/examples/steps/local/validators/local-validators.ts
/**
 * Validator: Verifies that the value is not null/undefined
 */
export const notNull = (headerKey: string): LocalStepValidator => ({
    headerKey,
    name: 'Not Null',
    fn: (value: string, row: any) => ({
        isValid: value !== null && value !== undefined,
        validationCode: 'NOT_NULL',
        message: value === null || value === undefined ? 'Value cannot be null' : undefined,
        value,
        step: 'local',
    }),
});
```

Regex validator (factory with args and safe error handling):

```39:75:src/examples/steps/local/validators/local-validators.ts
export const regex = (headerKey: string, pattern: string, flags: string = ''): LocalStepValidator => ({
    headerKey,
    name: 'Regex Pattern',
    fn: (value: string, row: any, ...args: any[]) => {
        const regexPattern: string = args[0];
        const regexFlags: string = args[1] ?? '';
        if (!regexPattern) return { isValid: false, validationCode: 'REGEX_ERROR', message: 'Pattern is required', value, step: 'local' };
        try {
            const regex = new RegExp(regexPattern, regexFlags);
            const isValid = regex.test(value);
            return { isValid, validationCode: 'REGEX_PATTERN', message: !isValid ? `Value does not match pattern: ${regexPattern}` : undefined, value, step: 'local' };
        } catch (error) {
            return { isValid: false, validationCode: 'REGEX_ERROR', message: `Invalid regex pattern: ${(error as Error).message}`, value, step: 'local' };
        }
    },
    args: [pattern, flags],
});
```

Exposing validators

- Provide factory collections (see `createLocalValidators`) and an exported map (`LocalValidators`) so layouts can instantiate validators per header.

Best practices

- Always null-check `value` and fields on `row` before accessing them.
- Keep validators deterministic and fast — they run for every row.
- Return clear `validationCode` strings to help UIs group or filter errors.

Where to use

- Use inside `localSteps` in your layout (`src/examples/layout/layout-example.ts`). The engine will call each validator for every row cell configured in the step.
