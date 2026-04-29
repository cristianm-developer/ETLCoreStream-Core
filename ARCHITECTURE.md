# ETL CoreStream System Architecture

This document describes the architecture of **`etl-corestream/core`**, a modular, headless ETL orchestration library, based on the current Orchestrator implementation and the repository's module organization.

## Summary

- **Core**: a central Orchestrator implemented with XState that coordinates the ETL flow via **stream-based pipes** (import → mapping → persist → global validation/transform → user view / export / edit).
- **Principle**: strict, versioned internal schemas to ensure compatibility; pluggable modules via interfaces for maximum flexibility.
- **Stream Communication**: modules communicate via `ReadableStream` pipes, keeping the UI responsive and decoupling module lifecycles.
- **Non-blocking Processing**: states initiate processing pipelines and allow users to interact with other functions (watch data, change pages, edit rows) while background processing continues. Final processing events guard completion without blocking user actions.
- **Observability**: the Orchestrator exposes reactive observables (state$, context$, metrics$, progress$) backed by RxJS `BehaviorSubject` and Preact Signals for real-time updates.

## Core Architectural Characteristics

### 1. Modular Library with Dependency Injection

**`etl-corestream/core`** is built as a **headless, provider-based system** where the `ProviderModule` acts as a dependency injector. Users can:
- **Swap any module** (importer, mapper, persistence, viewer, exporter, etc.) while maintaining the same contract.
- **Implement custom modules** by adhering to interface specifications (`i-importer.ts`, `i-persistence.ts`, etc.).
- **Compose different implementations** at runtime based on deployment context or use case.

**Benefits:**
- Test different storage backends (IndexedDB, SQLite, PostgreSQL) without changing orchestrator logic.
- Use different UI frameworks or render strategies (vanilla DOM, React, Vue) via adapter modules.
- Replace importers to support new file formats or data sources.
- Customize validation/transformation engines per domain.

### 2. Headless Library Design

**`etl-corestream/core`** is **UI-agnostic and backend-agnostic**. It provides:
- **Core ETL orchestration** without prescribing how data is rendered or persisted.
- **Observable-based API** (`state$`, `context$`, `metrics$`, `progress$`) for consumers to build their own UI adapters.
- **Stream-based architecture** that works equally well in browser, Node.js, or edge environments.

**Adapters layer** (external to core):
- **UI adapters**: React hooks, Vue composables, Svelte stores that consume orchestrator observables.
- **Persistence adapters**: IndexedDB, localStorage, backend APIs, or file systems.
- **Importer adapters**: CSV, JSON, Excel, API endpoints, databases.
- **Exporter adapters**: CSV files, API calls, message queues, data warehouses.

### 3. Performance-Focused, Resource-Respectful

**`etl-corestream/core`** is designed to **maximize respect for user and system resources**:

**Memory efficiency:**
- **Stream-based processing**: data flows through pipes without holding entire datasets in memory.
- **Pagination**: UI fetches only the current page of rows; large datasets remain in persistence.
- **Lazy evaluation**: metadata and metrics are computed on-demand via `loadingMetrics` actor.
- **Garbage collection**: streams complete and release resources; unused data is not retained.

**CPU efficiency:**
- **Non-blocking operations**: `processingRows` flag allows UI to remain responsive during heavy processing.
- **Chunked processing**: streams process data in small batches, preventing long task runs that block the event loop.
- **Concurrent user actions**: while background import/export/validation runs, users can interact with the UI (pagination, editing) without waiting.

**Network efficiency (for backend adapters):**
- **Stream chunking**: send/receive data in efficient batches rather than monolithic payloads.
- **Pagination**: download only required pages of results.
- **Cancellation support**: `AbortSignal` allows stopping in-flight requests when user cancels operations.

**Storage efficiency:**
- **Indexed storage**: persistence layer maintains indexed rows/errors for fast queries.
- **Metrics caching**: computed metrics are cached and updated incrementally.
- **Minimal duplication**: single source of truth in persistence; viewers read without copying.

## Main structure

- `src/core/orchestator`: Orchestrator (XState machine, contexts, events, states).
- `src/core/[module]`: Modules define reusable ETL capabilities, each organized with the following internal structure:
  - **importer**: reads and parses data from external sources; returns a `ReadableStream` of raw rows.
  - **mapper**: transforms raw stream data to the internal schema based on layout rules; pipes stream-to-stream.
  - **persistence**: stores/retrieves processed data (IndexedDB, in-memory, cache); exposes stream-based read/write operations.
  - **local-step-engine**: executes user-triggered transformations and validations on individual rows; pipes streams for edited row workflows.
  - **global-step-engine**: executes batch transformations and validations on entire dataset; reads and writes via streams.
  - **viewer**: formats and prepares data for UI consumption (pagination, filtering, sorting); reads from persistence without blocking.
  - **exporter**: outputs processed data to external formats (CSV, JSON, database); consumes stream output.
  - **logger**: centralized logging for events, errors, and metrics.
  - **provider**: configuration and dependency injection; each module accepts options to customize behavior.
- `src/shared/schemes`: central schemas and types (layout, row, metrics, validators).

## Observability and Reactivity

**`etl-corestream/core`** exposes a **dual-mode observability pattern** using both RxJS observables and Preact Signals. Developers can choose one or both based on their needs:

### Observables (RxJS)

Perfect for reactive frameworks and functional composition:
```ts
orchestrator.state$.subscribe(state => {
  console.log('State changed to:', state);
});

orchestrator.context$.subscribe(context => {
  console.log('Current context:', context);
});

orchestrator.metrics$.subscribe(metrics => {
  console.log('Metrics updated:', metrics);
});

orchestrator.progress$.subscribe(progress => {
  console.log('Progress:', progress); // [{label: 'importing', value: 60}, ...]
});
```

### Signals (Preact Signals)

Perfect for synchronous, fine-grained reactivity and minimal re-renders:
```ts
// Access current value synchronously
const currentState = orchestrator.state;       // e.g., 'waiting-user'
const currentMetrics = orchestrator.metrics;   // e.g., {totalRows: 1000, errorCount: 5}

// Use in reactive frameworks
watch(() => orchestrator.state, (newState) => {
  // React to state changes
});
```

Both modes are **always available** and **synchronized**. Choose observables for stream-based logic, signals for immediate access to current values.

## Central contract (default context)

The Orchestrator maintains a central context that acts as a contract between modules. The context is shared via observables (`context$`) and signals, allowing modules and the UI to react to changes without direct coupling:

```ts
const DEFAULT_CONTEXT: OrchestatorContext = {
    file: null,
    layout: null,
    metrics: undefined,
    progress: [],                    // Array of {label, value} for tracking multi-step operations
    activeStream: null,              // Current ReadableStream being processed (null when idle)
    unexpectedError: null,
    editingRow: null,
    removingRow: null,
    exporting: null,
    currentRowsFilter: null,         // Filter applied to current view
    currentRows: null,               // Current page of rows (lazy-loaded from persistence)
    currentErrors: null,             // Current page of errors (lazy-loaded from persistence)
    currentPage: 1,
    totalPages: 0,
    totalEstimatedRows: null,        // Estimated count used during initial import
    processingRows: boolean,         // Flag to indicate background processing; UI remains interactive
}
```

**Key design decisions:**
- `activeStream`: stores the current processing stream; allows states to pipe data through multiple transforms without blocking UI.
- `processingRows`: boolean flag that indicates background work is ongoing. Users can still navigate pages, edit rows, or trigger exports without waiting for streaming to complete.
- `progress`: array-based structure for multi-step progress tracking (e.g., "importing: 60%", "validating: null").
- `currentRows`, `currentErrors`: lazy-loaded from persistence based on `currentPage` and `currentRowsFilter`.

## Developer-Friendly API

While ETL CoreStream uses **XState internally** to handle complex state transitions and side effects, we expose a **simple, friendly API** that abstracts away XState details. Developers never send raw events; instead, they call intuitive methods:

### Public Methods (XState → Friendly API)

```ts
// Instead of: orchestrator.actor?.send({ type: 'LAYOUT_SELECTED', layout })
orchestrator.selectLayout(layout);

// Instead of: orchestrator.actor?.send({ type: 'FILE_SELECTED', file })
orchestrator.selectFile(file);

// Instead of: orchestrator.actor?.send({ type: 'CHANGE_PAGE', pageNumber })
orchestrator.changePage(pageNumber);

// Instead of: orchestrator.actor?.send({ type: 'EDIT_ROW', rowEdition: { rowId, key, value } })
orchestrator.editRow(rowId, key, value);

// Instead of: orchestrator.actor?.send({ type: 'REMOVE_ROW', rowId })
orchestrator.removeRow(rowId);

// Instead of: orchestrator.actor?.send({ type: 'EXPORT', id, target })
orchestrator.export(id, target);

// Reset the state machine
orchestrator.reset();

// Stop and cleanup
orchestrator.stop();
```

### Benefits of Friendly API

- **Intuitive**: developers think in terms of actions, not events.
- **Typesafe**: method signatures enforce correct arguments (no typos in event types).
- **Encapsulation**: XState is an implementation detail; future versions can swap state management without changing the public API.
- **Self-documenting**: IDE autocomplete shows available actions.

### Internal Implementation

```ts
public selectFile = (file: File) => {
  this.actor?.send({ type: 'FILE_SELECTED', file });
}

public editRow = (rowId: number, key: string, value: string) => {
  this.actor?.send({ type: 'EDIT_ROW', rowEdition: { rowId, key, value } });
}

// ... and so on
```

The friendly methods are thin wrappers that call XState `send()` internally, maintaining a clean separation between the public interface and the state machine implementation.

### Key principles:

1. **Streams as pipes**: Each actor returns or consumes `ReadableStream` objects. States transition based on completion events (`onDone`) or user events, while streams continue processing in the background.
2. **Non-blocking processing**: `FIRST_CHUNK_RAW_READY` and `FIRST_CHUNK_PROCESSED_READY` events allow early UI updates. The machine can transition to `initializing-user-view` and let users interact (change pages, edit rows) while the stream is still being processed.
3. **Unrestricted transitions**: From `waiting-user`, users can trigger:
   - `CHANGE_PAGE`: reload current view with pagination
   - `EDIT_ROW`: enter editing sub-machine (local-step-pipe → persist → global-step-pipe → back to waiting-user)
   - `REMOVE_ROW`: delete and refresh view
   - `EXPORT`: stream data to external format without freezing UI

### Example (states and stream-based invokes):

```ts
this.machine = createMachine(
    {
        id: `ETL-${this.id}`,
        initial: 'initializing',
        context: DEFAULT_CONTEXT,
        states: {
            importing: { 
                invoke: { 
                    id: 'import-file', 
                    src: 'importFile',
                    input: ({ context }) => ({ file: context.file }),
                    onDone: {
                        target: 'mapping',
                        actions: assign({ activeStream: event.output.stream, totalEstimatedRows: event.output.totalRowsEstimated })
                    }
                } 
            },
            mapping: { 
                invoke: { 
                    id: 'mapping', 
                    src: 'mapping',
                    input: ({ context }) => ({ activeStream: context.activeStream, layout: context.layout, totalEstimatedRows: context.totalEstimatedRows })
                } 
            },
            persisting: {
                invoke: {
                    id: 'persisting',
                    src: 'persisting',
                    input: ({ context }) => ({ activeStream: context.activeStream, totalEstimatedRows: context.totalEstimatedRows }),
                },
                on: {
                    FIRST_CHUNK_RAW_READY: {
                        target: 'handle-global-steps',  // Transition early while stream is still persisting
                    }
                }
            },
            'waiting-user': {
                on: {
                    CHANGE_PAGE: {
                        target: 'initializing-user-view',
                        actions: assign({ currentPage: event.pageNumber })
                    },
                    EDIT_ROW: {
                        target: 'editing-row',
                        actions: assign({ editingRow: event.rowEdition, processingRows: true })
                    }
                }
            }
        }
    }
)
```

## Extension points (actors)

Actors are the extension points where the Orchestrator calls external module capabilities via the provider. Each actor either:
- **Produces** a stream (importer, local/global step pipes)
- **Consumes** a stream (mapper, persistence, exporter)
- **Returns metadata** (metrics, rows for pagination)

```ts
actors: {
    importFile: fromPromise(async ({ input, signal }) => {
        const importer = this.provider.modules.importer;
        const [stream, totalRowsEstimated] = importer.readFileStream(input.file, signal);
        return { stream, totalRowsEstimated };  // Immediate return; stream processes in background
    }),
    
    mapping: fromPromise(async ({ input, signal }) => {
        const mapper = this.provider.modules.mapper;
        // Mapper pipes activeStream through transformations
        return mapper.handleStream(input.activeStream, input.layout, input.totalEstimatedRows, signal);
    }),
    
    persisting: fromPromise(async ({ input, emit, signal }) => {
        const persistence = this.provider.modules.persistence;
        // Emit FIRST_CHUNK_RAW_READY when first batch is available, allowing early UI transition
        persistence.saveStream(input.activeStream, input.totalEstimatedRows, () => emit({ type: 'FIRST_CHUNK_RAW_READY' }), signal);
    }),
    
    localStepPipe: fromPromise(async ({ input, signal }) => {
        const localStepEngine = this.provider.modules.localStepEngine;
        const persistence = this.provider.modules.persistence;
        
        // Get stream of edited row, apply local steps, return transformed stream for persisting
        const stream = persistence.getRowsStream({ rowIdIn: [input.rowEdition.rowId] });
        const resultStream = await localStepEngine.handleStream(stream, input.layout, 1, signal);
        return resultStream;  // Output: ReadableStream for next state
    }),
    
    globalStepPipe: fromPromise(async ({ input, signal }) => {
        // Process entire dataset through global steps; no return value (fires callback on FIRST_CHUNK_PROCESSED_READY)
        const globalStepEngine = this.provider.modules.globalStepEngine;
        const persistence = this.provider.modules.persistence;
        
        for (const step of input.layout.globalSteps) {
            const stream = persistence.getRowsStream(step.filter.rows);
            const resultStream = globalStepEngine.handleStep(stream, step, null, signal);
            await persistence.saveStream(resultStream, null, () => emit({ type: 'FIRST_CHUNK_PROCESSED_READY' }), signal);
        }
    }),
}
```

## Design principles

1. **Stream-based module communication**
  - Modules communicate via `ReadableStream` pipes, not direct callbacks or events. This decouples module lifecycles and allows background processing without UI freezing.
  - Each module implements stream-oriented methods (e.g., `readFileStream()`, `handleStream()`, `saveStream()`, `getRowsStream()`).
  - Streams can be piped through `TransformStream` to add validations, mappings, or filtering without creating intermediate data structures.

2. **Non-blocking, reactive architecture**
  - User interactions (page change, edit, export) are independent of background processing. The `processingRows` flag allows the UI to indicate activity without blocking user actions.
  - Early transition events (`FIRST_CHUNK_RAW_READY`, `FIRST_CHUNK_PROCESSED_READY`) unblock the state machine, allowing the UI to show data while streams continue processing.
  - Context updates are published as observables (`context$`, `state$`, `metrics$`, `progress$`), enabling UI components to react in real-time.

3. **Strong central schemas**
  - Types and schemas in `shared/schemes` are the source of truth. Changes must be versioned and accompanied by migration helpers if incompatible.

4. **Modularity via interfaces**
  - Each capability exposes an interface (`i-*.ts`). The Orchestrator consumes those interfaces from `ProviderModule`.
  - Examples: `IImporter`, `IPersistence`, `IMapper`, `IViewer`, `IExporter`, `ILogger`.

5. **Edge adapters**
  - Integrations with external libraries or data sources are implemented as adapters that normalize data to the internal schema before reaching the Orchestrator.

6. **Observability and recovery**
  - Orchestrator publishes `state$`, `context$`, `metrics$`, `progress$`. Central logging via `ILoggerModule`.
  - Errors are stored in `context.unexpectedError` and the machine includes an `error` state with `RESET`.

7. **Cancellation and cleanup**
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

1. **Stream-oriented module design**
   - Always implement methods that return or consume `ReadableStream` for data transformations and bulk operations.
   - Use `TransformStream` for combining validations, mappings, or filtering without intermediate collections.
   - Avoid loading entire datasets into memory; use pagination or chunking via streams.

2. **Global validators and transforms: Always chunk**
   - **Never** load all rows into memory for validation/transformation. Always process **chunk-by-chunk** via streams.
   - Implement global validators as `TransformStream` that emit processed chunks:
     ```ts
     // Good: chunked validation
     const validationStream = new TransformStream({
       async transform(chunk, controller) {
         const { rows, errors } = chunk;
         const validated = await validateBatch(rows);  // batch-friendly
         controller.enqueue({ rows: validated, errors });
       }
     });
     
     // Bad: loading all rows
     const allRows = await persistence.getAllRows();  // DON'T DO THIS
     const validated = allRows.map(row => validate(row));
     ```
   - Emit progress updates for long-running global steps:
     ```ts
     const progressStream = new TransformStream({
       async transform(chunk, controller) {
         processedCount += chunk.rows.length;
         emit({ type: 'PROGRESS_UPDATE', processed: processedCount });
         controller.enqueue(chunk);
       }
     });
     ```
   - Use `AbortSignal` to support cancellation of long-running global validations.

3. **Creating custom modules and adapters**
   - **Core modules**: implement `i-*.ts` interfaces (IImporter, IPersistence, IMapper, etc.) to swap implementations.
   - **UI adapters**: subscribe to orchestrator observables and expose framework-specific APIs (e.g., React hooks using `useEffect` + `useState`, or Vue `computed` for signals).
   - **Backend adapters**: use orchestrator as a service layer; expose stream data to APIs or message queues.
   - **Example**: replace `persistence-indexdb` with `persistence-postgres` by implementing the same `IPersistence` interface using SQL queries instead of IndexedDB.

4. **Observability patterns**
   - Use **observables** (`state$`, `context$`, `metrics$`, `progress$`) for reactive chains and side effects.
   - Use **signals** for synchronous, immediate access to current state and fine-grained reactivity.
   - Subscribe early in component lifecycle and unsubscribe on cleanup to avoid memory leaks.
   - For UI: subscribe to `progress$` and display real-time step names and percentages.

5. **Performance best practices**
   - Use `processingRows` flag to render loading indicators without blocking user interactions.
   - Implement pagination at the viewer layer; never load all rows unless explicitly requested.
   - Monitor `progress$` observable to show real-time updates for long-running operations.
   - Batch small updates: instead of emitting per-row, accumulate and emit in chunks.
   - Use `AbortSignal` properly in custom modules to support cancellation and cleanup.

6. **Schema versioning and migration**
   - Formalize schema versioning (e.g., `schema.v1.ts`, `schema.v2.ts`) and publish a migration policy in `docs/`.
   - Test migration paths in integration tests.

7. **Testing stream workflows**
   - Add adapters and templates to create new modules (importer, persistence, exporter) that implement the `i-*.ts` interfaces.
   - In CI, run XState path tests on every PR to detect contract regressions and state machine flow issues.

8. **Provider as composition point**
   - Keep `ProviderModule` as the single composition point to facilitate swapping implementations at runtime or in tests.
   - Use constructor dependency injection to supply custom modules:
     ```ts
     const provider = new ProviderModule({
       modules: {
         importer: new CustomImporter(),
         persistence: new PostgresPersistence(),
         exporter: new S3Exporter(),
         // ... other modules
       }
     });
     orchestrator.initialize(provider);
     ```

9. **API interaction**
   - Use the public friendly methods (`selectLayout()`, `editRow()`, `changePage()`, etc.) instead of sending raw XState events.
   - These methods are typesafe and self-documenting.
   - The internal XState implementation can evolve without breaking the public API.

10. **UI binding**
    - Subscribe to `state$`, `context$`, `metrics$`, and `progress$` observables in components, or use signal getters for immediate access.
    - Use `processingRows` flag to show UI indicators without blocking interaction.
    - Fetch `currentRows`, `currentErrors` on-demand based on `currentPage` and filters (lazy-loading pattern).
    - For headless consumption: expose these observables as HTTP endpoints or WebSocket streams for remote UI clients.

## Flow diagrams

### Initial import flow (stream-based, non-blocking)

```
UI: Select Layout & File
    ↓
LAYOUT_SELECTED → waiting-layout → LAYOUT_SELECTED 
FILE_SELECTED → waiting-file → FILE_SELECTED
    ↓ (processingRows = true)
importing (activeStream = readFileStream)
    ↓
mapping (pipe stream through schema transformations)
    ↓
persisting (save stream chunks to persistence)
    ↓ (FIRST_CHUNK_RAW_READY emitted)
handle-global-steps (apply global validations/transforms in parallel)
    ↓ (FIRST_CHUNK_PROCESSED_READY or onDone)
initializing-user-view
    ├─ loading-metrics
    └─ loading-rows
    ↓ (processingRows = false)
waiting-user ← UI can now interact
```

### User interaction flow (non-blocking, unrestricted)

From `waiting-user`, all these actions can occur concurrently:

```
waiting-user (processingRows = false)
    │
    ├─ CHANGE_PAGE → initializing-user-view → waiting-user
    │
    ├─ EDIT_ROW → editing-row (processingRows = true)
    │   ├─ editing-data (update row in persistence)
    │   ├─ local-step-pipe (stream edited row through local steps)
    │   ├─ persisting (save result)
    │   ├─ global-step-pipe (pipe affected rows through global steps)
    │   ├─ cleaning
    │   └─ back to waiting-user (processingRows = false)
    │
    ├─ REMOVE_ROW → removing-row (processingRows = true)
    │   ├─ delete from persistence
    │   ├─ update metrics
    │   └─ back to initializing-user-view → waiting-user
    │
    └─ EXPORT → exporting (background)
        ├─ stream rows through exporter
        ├─ callback to UI (Stream) or file (File)
        └─ back to waiting-user
```

**Key insight**: While editing-row or exporting is active, `processingRows = true`, but the state machine doesn't block. Users can still call `CHANGE_PAGE` or observe `currentRows$` for real-time updates via persistence reads.

## Developer rules

- Do not break public schemas without versioning and migration.
- Write integration (path-based) tests for every new flow or contract change.
- Use adapters for any external dependency.
- Log events and metrics in `ILoggerModule` and expose them for consumption.

## Headless Architecture and Adapters

ETL CoreStream is a **headless orchestration library** designed for maximum portability and composition:

### Core vs. Adapters

**Core (`src/core/orchestator` + base modules):**
- XState machine coordinating state transitions and stream pipelines.
- Base interfaces (`i-*.ts`) defining module contracts.
- Observable/signal-based context sharing.
- No UI framework dependencies; no platform assumptions (browser-only, Node-only, etc.).

**Adapters (external or in `src/adapters/`):**
- **UI adapters**: Convert observables to framework-specific patterns (React hooks, Vue composables, Svelte stores).
- **Persistence adapters**: Connect to IndexedDB, SQLite, PostgreSQL, cloud storage, etc.
- **Importer adapters**: Support file formats (CSV, Excel, JSON), APIs, databases, message queues.
- **Exporter adapters**: Write to files, databases, APIs, data warehouses, real-time systems.

### Example: React UI Adapter

```ts
// adapters/react-hooks/useOrchestrator.ts
export function useOrchestrator(orchestrator: OrchestatorModule) {
  const [state, setState] = useState(orchestrator.state);
  const [context, setContext] = useState(orchestrator.getCurrentContext());
  const [metrics, setMetrics] = useState(orchestrator.metrics);

  useEffect(() => {
    const sub1 = orchestrator.state$.subscribe(setState);
    const sub2 = orchestrator.context$.subscribe(setContext);
    const sub3 = orchestrator.metrics$.subscribe(setMetrics);
    return () => { sub1.unsubscribe(); sub2.unsubscribe(); sub3.unsubscribe(); };
  }, [orchestrator]);

  return { state, context, metrics, actions: { selectLayout, selectFile, editRow, export: export_ } };
}
```

### Example: PostgreSQL Persistence Adapter

```ts
// adapters/persistence-postgres/main.ts
export class PostgresPersistence implements IPersistence {
  async saveStream(stream: ReadableStream, estimatedRows: number | null, onFirstChunk: () => void, signal: AbortSignal): Promise<void> {
    // Pipe stream to batch INSERT queries; emit onFirstChunk when first batch is persisted
  }

  getRowsStream(filter: RowFilter): ReadableStream {
    // Return a stream that fetches rows from PostgreSQL via cursor or pagination
  }

  async updateMetrics(): Promise<void> {
    // Compute metrics (totalRows, errorCount) via SQL COUNT queries
  }
}
```

### Benefits of Headless + Adapter Design

| Benefit | How It Works |
|---------|-------------|
| **Multi-platform** | Same core logic runs in browser, Node.js, Deno, edge workers. |
| **Framework-agnostic** | UI adapters bridge orchestrator to any frontend framework. |
| **Storage flexibility** | Swap persistence without changing orchestrator or UI. |
| **Testing simplicity** | Mock adapters for unit tests; compose real adapters for integration tests. |
| **Scalability** | Run orchestrator on server; stream data to lightweight browser UI via WebSocket. |
| **Performance** | Each adapter optimizes for its context (browser memory, server throughput, etc.). |

## Conclusion

The **`etl-corestream/core`** architecture combines **XState for robust state management** with **stream-based pipes for responsive, non-blocking data processing**. Key achievements:

- **Responsive UI**: Early transition events and `processingRows` flag allow users to interact while background processing continues.
- **Modular pipeline**: Each module is a self-contained stream transformer, making the system flexible and testable.
- **Reactive contract**: Observables and signals bridge the state machine and UI, enabling real-time updates without tight coupling.
- **Scalable**: Streams avoid memory bloat; pagination and chunking keep resource usage constant regardless of dataset size.
- **Headless and portable**: No UI framework or storage backend dependencies; compose with adapters for any deployment context.
- **Resource-respectful**: Memory-efficient streams, non-blocking processing, lazy-loading, and cancellation support ensure the library respects user and system resources.

The repository already follows this solid pattern. Continued emphasis on stream-oriented module design and path-based integration tests will strengthen compatibility while maintaining flexibility.

## Performance Guarantees

**`etl-corestream/core`** commits to the following resource-efficiency principles:

### Memory

- **Constant memory footprint**: Processing 1GB or 100MB of data uses the same amount of memory (within chunk-size margins).
- **Streaming**: No intermediate collections; data flows through pipes.
- **Pagination**: UI viewers fetch only the current page of rows; remaining data stays in indexed storage.
- **Garbage collection friendly**: Streams complete and release resources without circular references.

### CPU

- **Non-blocking**: `processingRows` allows concurrent user interactions during long operations.
- **Chunked processing**: Batch operations prevent long task runs that block the event loop.
- **Early UI unlock**: `FIRST_CHUNK_RAW_READY` emits as soon as the first batch is persisted, not waiting for the entire import.
- **Cancellation**: `AbortSignal` support allows stopping expensive operations immediately.

### Storage

- **Indexed queries**: persistence layer supports efficient row/error lookup without table scans.
- **Minimal duplication**: single source of truth; viewers query, not copy.
- **Lazy metrics**: Metrics computed on-demand or cached incrementally.

### Network (for backend-adapter deployments)

- **Chunked transfer**: Stream data in efficient batches; adapt chunk size to network conditions.
- **Pagination**: Fetch only required pages of results via persistent queries.
- **Compression**: Adapters can apply gzip or other compression to chunks.
- **Cancellation**: Stop in-flight requests when user cancels operations.