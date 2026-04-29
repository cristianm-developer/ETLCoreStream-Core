# ETL CoreStream System Architecture

This document describes the project's architecture based on the current Orchestrator implementation and the repository's module organization.

## Summary

- Core: a central Orchestrator implemented with XState that coordinates the ETL flow (import → mapping → validate/transform → persist → global validation/transform → user view / export / edit).
- Principle: strict, versioned internal schemas to ensure compatibility; pluggable modules via interfaces for maximum flexibility.
- Observability: the Orchestrator exposes observables (state$, context$, metrics$) and uses a central logger.

## Main structure

- `src/core/orchestator`: Orchestrator (XState machine, contexts, events, states).
- `src/core/[module]`: Modules define reusable ETL capabilities, each organized with the following internal structure:
  - **importer**: reads and parses data from external sources (files, APIs, databases).
  - **mapper**: transforms raw data to the internal schema based on layout rules.
  - **persistence**: stores/retrieves processed data (in-memory, database, cache).
  - **local-step-engine**: executes user-triggered transformations and validations on individual rows.
  - **global-step-engine**: executes batch transformations and validations on the entire dataset.
  - **viewer**: formats and prepares data for UI consumption (pagination, filtering, sorting).
  - **exporter**: outputs processed data to external formats (CSV, JSON, database).
  - **logger**: centralized logging for events, errors, and metrics.
  - **provider**: configuration and dependency injection; each module accepts options to customize behavior.
- `src/shared/schemes`: central schemas and types (layout, row, metrics, validators).

## Central contract (default context)

The Orchestrator maintains a central context that acts as a contract between modules:

```ts
const DEFAULT_CONTEXT: OrchestatorContext = {
    file: null,
    layout: null,
    metrics: {
        totalRows: 0,
        processedRows: 0,
        errorCount: 0,
    },
    progress: 0,
    activeStream: null,
    unexpectedError: null,
    editingRow: null,
    removingRow: null,
    exporting: null,
    currentRowsFilter: null,
    currentRows: null,
    currentErrors: null,
    pageNumber: 1,
}
```

## State machine and actors

- The XState machine defines composite states and extension points via invokes/actors.
- Each actor delegates to a concrete module provided by the Provider (importer, mapper, persistence, engines, viewer, exporter).

### Example (states and invokes definition)

```ts
this.machine = createMachine(
    {
        id: `ETL-${this.id}`,
        initial: 'initializing',
        context: DEFAULT_CONTEXT,
        ...
        states: {
            initializing: { ... },
            'waiting-layout': { ... },
            'waiting-file': { ... },
            importing: { invoke: { id: 'import-file', src: 'importFile', ... } },
            mapping: { invoke: { id: 'mapping', src: 'mapping', ... } },
            ...
        }
    }
)
```

## Extension points (actors)

- Actors are the extension points where the Orchestrator calls external capabilities through the provider:

```ts
actors: {
    importFile: fromPromise(async ({ input, signal }: any) => {
        const importer = this.provider.modules.importer;
        return importer.readFileStream(input.file, signal);
    }),
    mapping: fromPromise(async ({ input, signal }: any) => {
        const mapper = this.provider.modules.mapper;
        return mapper.handleStream(input.activeStream, input.layout, signal);
    }),
    ...
}
```

## Design principles

1. Strong central schemas
  - Types and schemas in `shared/schemes` are the source of truth. Changes must be versioned and accompanied by migration helpers if incompatible.
2. Modularity via interfaces
  - Each capability exposes an interface (`i-*.ts`). The Orchestrator consumes those interfaces from `ProviderModule`.
  - Examples: `IImporter`, `IPersistence`, `IMapper`, `IViewer`, `IExporter`, `ILogger`.
3. Edge adapters
  - Integrations with external libraries or data sources are implemented as adapters that normalize data to the internal schema before reaching the Orchestrator.
4. Observability and recovery
  - Orchestrator publishes `state$`, `context$`, `metrics$`. Central logging via `ILoggerModule`.
  - Errors are stored in `context.unexpectedError` and the machine includes an `error` state with `RESET`.
5. Cancellation and cleanup
  - Invokes use `signal` (AbortSignal) to cancel long-running operations.
  - `reset()` and `stop()` clean up actors and call `persistence.clear()` when applicable.

## Testing and compatibility guarantees

- Path-based tests (XState graph paths) are used to validate full flows, transitions and output contracts.
- Example: helpers `waitForState` and `waitForContext` used in `src/core/orchestator/orchestrator-xstate-graph.test.ts`.

```ts
/** Helper to wait until the state equals a specific value */
const waitForState = (
  orchestrator: OrchestatorModule,
  targetState: string | string[],
  timeoutMs = 10000
): Promise<string> => { ... }
```

## Practical recommendations

- Formalize schema versioning (e.g. `schema.v1.ts`, `schema.v2.ts`) and publish a migration policy in `docs/`.
- Add adapters and templates to create new modules (importer, persistence, exporter) that implement the `i-*.ts` interfaces.
- In CI, run XState path tests on every PR to detect contract regressions.
- Keep `ProviderModule` as the single composition point to facilitate swapping implementations at runtime or in tests.

## Textual flow diagram

- UI → LAYOUT_SELECTED → Orchestrator
  - FILE_SELECTED → importing (invoke importFile) → mapping → persisting → handle-global-steps → initializing-user-view → waiting-user
  - User actions: EDIT_ROW → editing-row → local-step-pipe → persisting → global-step-pipe → cleaning → waiting-user
  - EXPORT → exporting (invoke exporter) → back to waiting-user

## Developer rules

- Do not break public schemas without versioning and migration.
- Write integration (path-based) tests for every new flow or contract change.
- Use adapters for any external dependency.
- Log events and metrics in `ILoggerModule` and expose them for consumption.

## Conclusion

- The repository already follows a solid pattern: a strict core of contracts + interchangeable modules. Formalizing schema versioning and adapting CI for contract tests will strengthen compatibility while keeping the flexibility to integrate new modules.

---

Document generated automatically by the assistant. If you want, I can commit it to the repository or generate a visual diagram (.svg/.png).