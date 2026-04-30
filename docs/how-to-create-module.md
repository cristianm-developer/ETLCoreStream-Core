# How to create your own module

This guide explains how to implement custom modules for ETL CoreStream, the supported module kinds, the contract they must follow, and notes about each interface in `src/core/*`.

Summary

- Module kinds: importer (import-file), mapping, persistence, local/global steps engine, viewer, exporter, logger, orchestrator/provider adapters.
- Always implement the interfaces in `src/core/*` and register your implementation in the `ProviderModule`.
- Stream-first design: prefer ReadableStream/TransformStream; support AbortSignal for cancellation and expose progress via Signal or callbacks.

Why follow the interface

- The Orchestrator depends on typed contracts. If your module implements the correct interface, it can be swapped at runtime without changing orchestrator logic.
- Provide: id, expected methods, progress signals, and correct stream shapes (e.g. { rows: RowObject[] }).

Registering your module

- Construct a ProviderModule with your implementations:

```ts
const provider = new ProviderModule({
  modules: {
    importer: new MyImporter(),
    mapping: new MyMapper(),
    persistence: new MyPersistence(),
    exporter: new MyExporter(),
    logger: new MyLogger(),
    localStepEngine: new MyLocalSteps(),
    globalStepEngine: new MyGlobalSteps(),
    viewer: new MyViewer(),
  },
});
orchestrator.initialize(provider);
```

Notes on streams, progress and cancellation

- Streams: methods often return or accept ReadableStream<{ rows: RowObject[] }>. Process chunk-by-chunk using TransformStream.
- Progress: expose a `Signal<number|null>` via getProgress() so UI can read progress synchronously.
- Cancellation: accept an optional `AbortSignal` parameter and stop processing early when signaled.
- Callbacks: persistence.saveStream accepts an `onFirstChunkReady` callback; call it ASAP after first chunk persisted to allow UI early unlock.

Interface summaries (quick reference)

- Importer — read file stream

See `src/core/import-file/i-import-file-module.ts`.

Key points:

- Implement `readFileStream(file: File, signal?: AbortSignal): [ReadableStream, Signal<number|null>]`.
- Return a ReadableStream that emits chunks and a Signal for progress. Respect allowed mimetypes, chunkSize and maxFileSize from options.

- Mapping — transform incoming raw stream to internal rows

See `src/core/mapping/i-mapping-module.ts`.

Key points:

- Implement `handleStream(stream, layout, totalRowEstimated, signal?, step?, order?) => Promise<ReadableStream>`.
- Use TransformStream to map raw rows to RowObject[] consistent with `LayoutBase`. Provide `handleRemap` for manual column remapping.

- Persistence — store and read processed rows/errors

See `src/core/persistence/i-persistence-module.ts`.

Key points:

- Implement `saveStream(stream, totalRowEstimated, onFirstChunkReady?, signal?)` and `getRowsStream(filter)`, `getErrorsStream(filter)`.
- Provide CRUD helpers (`getRowById`, `updateRow`, `deleteRow`, `clear`) and metrics (`updateMetrics`, `getMetrics`).
- Call `onFirstChunkReady` as soon as first persisted batch is available to emit FIRST_CHUNK_RAW_READY.

- Local steps engine — single-row edits and local validations/transforms

See `src/core/steps-engine/i-local-steps-engine-module.ts`.

Key points:

- Implement `handleStream(stream, layout, totalRowEstimated, signal?, step?, order?) => Promise<ReadableStream>`.
- Designed for small, user-triggered transformations/validators (editing a row). Return a stream with transformed row(s).

- Global steps engine — batch transforms and validators

See `src/core/steps-engine/i-global-steps-engine-module.ts`.

Key points:

- Implement `handleSteps(layout, options?, signal?) => Promise<void>` to orchestrate all global steps.
- Implement `handleStepTransform` and `handleStepValidator` to run single step transforms/validators and produce streams of rows/errors.
- `handleStep(stream, step, totalRowsEstimated, signal?)` returns a ReadableStream with rows, errors and removedErrors.

- Viewer — pagination / edit / remove helpers

See `src/core/viewer/i-viewer-module.ts`.

Key points:

- Implement `getRowsWithPagination(persistence, metrics, filter?, pageNumber?, signal?) => Promise<PaginatedRows>`.
- Implement `editRow`, `removeRow` using the provided persistence module instance. Keep operations non-blocking and use `signal` when available.

- Exporter — stream transforms and CSV export

See `src/core/exporter/i-exporter-module.ts`.

Key points:

- `exportStream(inputStream, exportFn, signal?) => Promise<ReadableStream>` applies transforms over stream.
- `exportToCsv(inputStream, totalRowsCount, filename, diccLabels?, onProgress?, signal?) => Promise<void>` should write incrementally and call onProgress with bytes/rows/percentage.

- Logger — centralized logs and status

See `src/core/logger/i-logger-module.ts`.

Key points:

- Expose `logs$` and `status$` Observables, `getLogs(...)`, `log(message, level, step, id)` and `updateStatus`.
- Use observables so Orchestrator and UI can subscribe; keep log history bounded or paginated if large.

- Orchestrator adapter interface (consumer-facing)

See `src/core/orchestrator/i-orchestrator-module.ts`.

Key points:

- The Orchestrator exposes lifecycle methods (`initialize`, `stop`, `reset`), actions (`selectFile`, `selectLayout`, `changePage`, `editRow`, `export`, ...), and reactive observables/signals.
- Implementations should forward events to the internal XState machine and expose the friendly API methods.

Testing your module

- Unit test stream behavior with small ReadableStream sources and assert the output stream emits expected chunks.
- Integration test: register your module in a ProviderModule and run a path-based orchestrator test (see tests in `src/core/orchestrator`).

Checklist before publishing

- Implements required interface methods and types exactly.
- Supports AbortSignal and exposes progress.
- Processes data chunk-by-chunk; does not load entire dataset into memory.
- Emits early-on-first-chunk where applicable (persistence/exporter).
- Adds unit + integration tests and documents options (chunkSize, dbName, etc.).

Further reading

- Architecture overview: `ARCHITECTURE.md`
- Examples: `src/examples/` (see layout and browser presets)

If you want, I can generate a starter template implementation for any specific module (persistence, importer, exporter, etc.). Tell me which one.
