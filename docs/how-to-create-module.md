# How to create your own module

This guide explains how to implement custom modules for ETL CoreStream, the supported module kinds, the contracts (interfaces) they must respect, and practical notes about each interface in `src/core/*`.

Summary

- Module kinds: importer (import-file), mapper (mapping), persistence, recover, local/global steps engine, viewer, exporter, logger, and orchestrator/provider adapters.
- Respect typed interfaces in `src/core/*` — they are the runtime contracts the Orchestrator and other modules depend on.
- Stream-first design: prefer ReadableStream/TransformStream; support AbortSignal for cancellation and expose progress via a Signal or callbacks.

Module architecture — responsibilities and boundaries

The system is composed of small interchangeable modules. Each module has a well-defined responsibility and must expose the exact surface described by its interface. Keep modules single-purpose and avoid leaking internal concerns across boundaries.

- Importer (import-file): read raw input (files, blobs, streams) and expose a normalized ReadableStream of raw rows and a progress Signal. Validate incoming mimetypes and basic schema hints but do not perform mapping or persistence.
- Mapper (mapping): transform raw rows into internal RowObject[] according to a `LayoutBase`. Must accept a stream and return a ReadableStream of mapped rows (and optionally metadata). Mapping must be deterministic and side-effect free.
- Persistence: persist mapped rows, errors and metrics. Expose incremental persistence via saveStream and streaming reads (getRowsStream/getErrorsStream). Responsible for durability, optimistic concurrency, and efficient pagination.
- Recover: (optional module) implement resumption and recovery strategies after partial failures (e.g., retry-backed offset commits, transactional checkpoints). If present, expose methods to register checkpoints and restore processing state.
- Local steps engine: apply small, user-triggered transforms/validators to single rows or small batches. Designed for low-latency edits and should avoid heavy I/O.
- Global steps engine: run batch transforms/validators across the whole dataset. Orchestrates multi-step pipelines, emits progress and error streams, and must support pausing/resuming if possible.
- Viewer: provide paginated reads, search and light aggregation helpers using the persistence module. Viewer should never bypass persistence for writes.
- Exporter: transform persisted rows into export formats (CSV, JSONL, etc.) and stream bytes out incrementally. Report progress and support cancellation so UIs can show live export progress.
  -- Logger: centralized logging/status observable for UI and orchestrator. Use bounded buffers and provide queryable getLogs APIs.

-- Orchestrator / ProviderModule: composition layer that wires implementations together, validates contracts at registration time, and exposes lifecycle and high-level actions to consumers.

The Orchestrator sits between modules and is responsible for:

- Composing module implementations into a cohesive runtime (importer -> mapper -> persistence -> viewer/exporter).
- Validating module contracts at registration time and optionally performing a lightweight handshake.
- Routing high-level actions (selectFile, startImport, runGlobalSteps, export) to the correct module sequence and handling progress/cancellation across module boundaries.
- Exposing a friendly consumer API and reactive signals/observables for UI consumption.

See how provider modules are re-exported in `src/core/provider/index.ts` for the entry point that the Orchestrator uses when wiring implementations.

Interface contract rules — respect these to remain pluggable

1. Exact types and method signatures: implement the interfaces in `src/core/*` exactly. The Orchestrator uses TypeScript typings at build time and expects the runtime shapes to match.
2. Identity: every module implementation must expose a stable `id` string and any metadata declared by its interface.
3. Stream shapes: clearly document and follow the stream chunk shapes (e.g., { rows: RowObject[] }, { rows, errors, removedErrors }). Do not emit unexpected fields.
4. Errors: standardize error objects (code, message, context). Streams should surface errors in a defined shape; throwing exceptions may be used for fatal, unrecoverable conditions only.
5. Cancellation and timeouts: accept an optional `AbortSignal` and stop work promptly when signaled. Clean up resources and close streams.
6. Progress & observability: expose progress as a `Signal<number|null>` or via callbacks such as `onProgress(bytes, rows, percent)`. Emit early-first-chunk events where applicable.
7. Idempotency and side-effects: operations that persist state should be idempotent when retried where possible. Mappers and local-step engines should be side-effect free.
8. Validation at registration: ProviderModule should validate that required methods exist and optionally run a lightweight handshake (e.g., `ping()` or `version()` call) to ensure compatibility.
9. Versioning and backward compatibility: when changing interfaces, prefer additive changes and provide adapters shims when possible.
10. Resource limits: accept options like `chunkSize`, `maxFileSize`, and obey memory/IO limits (do not buffer entire datasets).

Practical implementation notes

- Registration example:

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
    recover: new MyRecover(), // optional
  },
});
orchestrator.initialize(provider);
```

- Validate at startup: run a small behavioral test for critical flows (import -> map -> persist -> view) in CI to catch contract drift early.
- Tests: unit-test streams with small synthetic ReadableStreams. Integration-test by registering the module in a ProviderModule and running orchestrator paths.
- Documentation: document options, supported mimetypes, backpressure behavior, and side-effects.
- Observability: expose metrics and make logs queryable so the Orchestrator can present useful diagnostics to users.

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
