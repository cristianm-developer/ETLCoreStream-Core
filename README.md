# ETL CoreStream

## Installation

```bash
npm install @etl-corestream/core
```

## Process Massive Files with Lightning-Fast Speed, No Freezing

**ETL CoreStream** is a revolutionary, headless ETL orchestration library built for the modern web. Handle massive files—gigabytes of data—with stream-friendly, async processing that keeps your application **unfrozen and responsive** while maintaining perfect control over performance.

### 🚀 Why Choose ETL CoreStream?

ETL CoreStream delivers **headless ETL** architecture—**we separate orchestration logic from data infrastructure**. You bring your rules and business logic; we provide the high-performance engine.

ETL CoreStream delivers **jank-free performance** in environments where resources matter:

- **Processing while staying responsive**: Real-time file editing, validation, and transformation without UI freezes
- **Handles massive files**: Gigabyte-scale datasets processed with constant memory footprint
- **Backend integration ready**: Async validations and transforms connect seamlessly to your backend services
- **Lightweight containers**: Optimized for low-spec environments, Docker containers, and edge deployments
- **Client-side native**: Perfect for front-end implementations with minimal overhead

Stop fighting with file upload limitations. Stop watching progress bars hang. **ETL CoreStream keeps your app flying.**

---

## ✨ Core Capabilities

### 1. **Stream-Friendly Architecture**

Process any file size without loading it into memory. Data flows through optimized pipes in chunks, keeping memory usage constant whether you're handling 1MB or 1GB files.

```typescript
// Your data streams through without freezing the UI
orchestrator.selectFile(largeFile); // Import starts immediately
// UI stays responsive while background processing happens
```

### 2. **Headless & Modular Design**

A truly headless solution with dependency injection. Load only the modules you need—importer, mapper, persistence, validator, exporter, or all of them. Swap implementations at runtime without changing a line of core logic.

**Pick what you use:**

- **Custom importers**: CSV, JSON, Excel, APIs, databases
- **Flexible persistence**: IndexedDB, SQLite, PostgreSQL, cloud storage
- **Smart validation**: Built-in and custom async validators
- **Multiple exporters**: Files, databases, APIs, webhooks

### 3. **Async Validations & Transforms Connected to Backend**

Validate and transform data **in real-time** while staying connected to your backend. Changes in the UI trigger re-validation and re-transformation immediately, reflecting backend business logic without refreshing.

```typescript
// Edit a row → instantly re-validate → re-transform → sync with backend
orchestrator.editRow(rowId, column, newValue);
// Validations run async, transforms apply, backend notified—all while you keep working
```

### 4. **Real-Time File Editing**

Edit imported data on-the-fly with instant feedback. Changes trigger:

- Local validations (immediate feedback)
- Global transforms (context-aware business rules)
- Backend sync (if configured)

No waiting, no freezing—just instant response.

### 5. **Versatile & Customizable**

Every layer is customizable. Implement interfaces, inject your modules, compose behavior. The architecture adapts to **your requirements**, not the other way around.

```typescript
const orchestrator = new OrchestatorModule(
  new ProviderModule({
    modules: {
      importer: new CustomCSVImporter(), // Your parser
      persistence: new PostgresPersistence(), // Your database
      localStepEngine: new MyValidations(), // Your rules
      exporter: new S3Exporter(), // Your output
    },
  })
);
```

### 6. **Smart Resource Management**

- **RAM**: Constant footprint regardless of file size (chunk-based processing)
- **CPU**: Non-blocking operations let users interact during heavy processing
- **Network**: Efficient batch transfers with compression support
- **Storage**: Indexed queries, pagination, zero duplication

Perfect for:

- 🐳 **Docker containers** with limited resources
- 📱 **Client-side implementations** on consumer devices
- 🌍 **Edge deployments** with bandwidth constraints
- 🏢 **Enterprise backends** processing massive datasets

### 7. **Jank-Free Performance Guarantees**

Your UI never freezes. While background processing happens:

- Navigate pages
- Edit rows
- Trigger exports
- Change filters

The `processingRows` flag keeps users informed without blocking interaction.

---

## 🎯 Use Cases

### Large File Import in Web Apps

Import million-row CSVs while users keep working. No waiting, no frozen UI.

### Real-Time Data Validation

Validate data as users edit, with backend sync. Instant feedback without round-trips.

### ETL Pipelines in Containers

Run resource-efficient ETL in low-spec Docker containers. Constant memory usage regardless of dataset size.

### Client-Side Data Processing

Process data in the browser without server dependency. All the power, all the control.

### Backend API Integration

Connect your ETL to microservices. Validate, transform, and sync data with backend APIs in real-time.

### Multi-Format Export

Import once, export to multiple formats (CSV, JSON, database, webhooks). Same data, any output.

---

## 🏗️ Architecture at a Glance

```
┌─────────────────────────────────────────────────────────┐
│            Orchestrator (XState-powered)                │
│  Manages state, events, and stream pipelines            │
└──────────────────┬──────────────────────────────────────┘
                   │
        ┌──────────┼──────────┐
        ↓          ↓          ↓
    ┌────────┐ ┌────────┐ ┌────────┐
    │Importer│ │Mapper  │ │Persist │  Stream-based modules
    └────────┘ └────────┘ └────────┘  (plug & swap)
        ↓          ↓          ↓
    ┌─────────────────────────────────┐
    │  Validation & Transform Engines  │  Local & Global
    │  (Async-enabled)                 │  Custom business logic
    └────────────────┬─────────────────┘
                     │
        ┌────────────┼────────────┐
        ↓            ↓            ↓
    ┌────────┐  ┌────────┐  ┌────────┐
    │Viewer  │  │Exporter│  │Logger  │  Output modules
    └────────┘  └────────┘  └────────┘
        ↓            ↓            ↓
   Pagination   Multiple     Observability
                 formats

Observable API: state$, context$, metrics$, progress$
```

### Key Design Principles

1. **Streams as Pipes**: Data flows through `ReadableStream` objects without blocking
2. **Non-Blocking Processing**: UI updates early while background work continues
3. **Modular Composition**: Load only what you need, swap implementations freely
4. **Reactive Updates**: Signals and RxJS observables for real-time UI binding
5. **Resource Conscious**: Pagination, chunking, garbage-collection friendly
6. **Headless First**: Zero UI framework dependencies—compose with any frontend

---

## 📦 What You Get

### Stream Processing

- ReadableStream pipes for memory-efficient data flow
- TransformStream integration for validators and mappers
- Chunk-based processing prevents event loop blocking

### Async Processing

- Background import/export while UI stays responsive
- Concurrent user actions (navigate, edit, export simultaneously)
- Early UI unlock with `FIRST_CHUNK_RAW_READY` event

### Real-Time Reactivity

```typescript
// RxJS Observables for reactive patterns
orchestrator.state$.subscribe((state) => console.log("State:", state));
orchestrator.context$.subscribe((ctx) => console.log("Context:", ctx));
orchestrator.metrics$.subscribe((m) => console.log("Metrics:", m));
orchestrator.progress$.subscribe((p) => console.log("Progress:", p));

// Preact Signals for synchronous access
const currentState = orchestrator.state; // Immediate access
const currentMetrics = orchestrator.metrics;
```

### Validation & Transformation

- Local steps: Row-level validations (instant feedback)
- Global steps: Dataset-level transforms (business rules)
- Async backend integration: Connect to APIs for complex logic
- Revalidation: Edit a row → re-validate → re-transform → synced

### Pagination & Lazy Loading

- Load only the current page of data
- Large datasets stay in indexed storage
- Viewers fetch on-demand without copying

### Cancellation & Cleanup

- AbortSignal support for long-running operations
- Safe cleanup with `stop()` and `reset()`
- Resource release after stream completion

---

## 🎮 Developer-Friendly API

**No raw XState events. No learning curve.** You don't need to understand XState to use ETL CoreStream—we abstract away the complexity of event dispatching and state management. Just intuitive methods:

```typescript
// Select layout and file
orchestrator.selectLayout(layout);
orchestrator.selectFile(file); // Import starts immediately; UI stays responsive

// Navigate and edit
orchestrator.changePage(2);
orchestrator.editRow(rowId, "email", "new@example.com");
orchestrator.removeRow(rowId);

// Export to any format
orchestrator.export(exportId, "csv");

// Control flow
orchestrator.reset();
orchestrator.stop();
```

The orchestrator handles all XState machinery internally—you focus on building features, not wrangling state machines.

---

## 🧩 Modular Dependency Injection

Swap implementations at runtime. Build adapters for any ecosystem:

```typescript
// IndexedDB persistence (browser)
new ProviderModule({ modules: { persistence: new IndexedDBPersistence() } });

// PostgreSQL (backend)
new ProviderModule({ modules: { persistence: new PostgresPersistence() } });

// S3 export (cloud)
new ProviderModule({ modules: { exporter: new S3Exporter() } });
```

Implement interfaces, inject your modules, go. The core orchestrator remains unchanged.

---

## 🚀 Performance Guarantees

### Memory

✅ **Constant footprint**: Processing 1GB uses the same memory as 100MB (within chunk size)
✅ **Stream-based**: No intermediate collections
✅ **Pagination**: Large datasets stay on disk
✅ **Garbage-collection friendly**: Streams release resources automatically

### CPU

✅ **Non-blocking**: UI stays responsive during heavy processing
✅ **Chunked processing**: Prevents event loop hangs
✅ **Early UI unlock**: Shows data before entire file is processed
✅ **Cancellation**: Stop expensive operations instantly

### Storage

✅ **Indexed queries**: Fast row/error lookups
✅ **Minimal duplication**: Single source of truth
✅ **Lazy metrics**: Computed on-demand

### Network

✅ **Chunked transfer**: Efficient batch sizes
✅ **Pagination**: Fetch only what you need
✅ **Compression**: Built-in support via adapters
✅ **Cancellation**: Stop in-flight requests

---

## 📊 The 1GB Challenge

While other libraries crash the browser attempting to parse 500,000 rows, **ETL CoreStream maintains constant ~50MB RAM consumption**, allowing users to continue editing row 1 while row 400,000 is being validated in the background.

**Real numbers:**

- **Constant memory**: 1MB file = 50MB overhead; 1GB file = same 50MB overhead
- **Responsive UI**: Zero frame drops even during peak processing
- **Instant feedback**: Edit any row immediately—validations queue and process without blocking
- **Scalable**: Same performance characteristics from browser to Docker container to Kubernetes cluster

---

## 🛡️ Error Recovery & Resilience

Built-in fault tolerance ensures your data stays safe:

- **AbortSignal support**: Cancel long-running operations instantly without corrupting state
- **Atomic persistence**: If a background process fails or is aborted, the persistence layer remains consistent
- **Clear recovery path**: Failed validations provide actionable error information without losing processed data
- **Graceful degradation**: Partial imports stay usable; errors are isolated to problematic rows, not entire datasets
- **Graceful degradation**: Partial imports stay usable; errors are isolated to problematic rows, not entire datasets

Your data is resilient by design.

## 🔐 Security & Privacy

ETL CoreStream is designed to keep your data under your control:

- All processing and persistence run locally by default — data remains on the device or infrastructure you choose.
- ETL CoreStream will not send your data to any external API or service unless you explicitly configure an adapter or exporter that does so.
- Integrations with backends or cloud exporters are opt-in modules; review and control any adapter that performs network calls.
- Best practices: use secure transport (HTTPS), limit adapter permissions, and audit/exporter configurations when enabling external integrations.

---

## Getting started

### Basic usage

```typescript
import { OrchestatorModule, ProviderModule } from "@etl-corestream/core";
import { DefaultImporter, IndexedDBPersistence } from "@etl-corestream/core/adapters";

// Create provider with default adapters
const provider = new ProviderModule({
  modules: {
    importer: new DefaultImporter(),
    persistence: new IndexedDBPersistence(),
    // ... other modules
  },
});

// Initialize orchestrator
const orchestrator = new OrchestatorModule(provider);

// Subscribe to state changes
orchestrator.state$.subscribe((state) => {
  console.log("Current state:", state);
});

orchestrator.metrics$.subscribe((metrics) => {
  console.log("Metrics:", metrics);
});

// Load a file
const fileInput = document.querySelector('input[type="file"]');
fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  orchestrator.selectFile(file);
});

// Edit data
orchestrator.editRow(rowId, "fieldName", "newValue");

// Export
orchestrator.export("export-1", "csv");
```

---

## 🎨 React Integration (Example)

```typescript
import { useEffect, useState } from 'react';

export function useOrchestrator(orchestrator) {
  const [state, setState] = useState(orchestrator.state);
  const [context, setContext] = useState(orchestrator.getCurrentContext());
  const [metrics, setMetrics] = useState(orchestrator.metrics);
  const [progress, setProgress] = useState(orchestrator.progress);

  useEffect(() => {
    const subs = [
      orchestrator.state$.subscribe(setState),
      orchestrator.context$.subscribe(setContext),
      orchestrator.metrics$.subscribe(setMetrics),
      orchestrator.progress$.subscribe(setProgress),
    ];
    return () => subs.forEach(s => s.unsubscribe());
  }, [orchestrator]);

  return { state, context, metrics, progress };
}

// In your component
export function DataProcessor({ orchestrator }) {
  const { state, context, metrics, progress } = useOrchestrator(orchestrator);

  return (
    <div>
      <h1>Processing Status: {state}</h1>

      {/* Show progress */}
      {progress.map((p, i) => (
        <div key={i}>{p.label}: {p.value}%</div>
      ))}

      {/* Show metrics */}
      {metrics && (
        <div>
          Total Rows: {metrics.totalRows} | Errors: {metrics.errorCount}
        </div>
      )}

      {/* Show current page of data */}
      {context.currentRows && (
        <table>
          <thead>
            <tr>
              {Object.keys(context.currentRows[0]).map(k => <th key={k}>{k}</th>)}
            </tr>
          </thead>
          <tbody>
            {context.currentRows.map((row, i) => (
              <tr key={i}>
                {Object.values(row).map((v, j) => <td key={j}>{v}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Show loading indicator if processing */}
      {context.processingRows && <div className="spinner">Processing...</div>}
    </div>
  );
}
```

---

## 📚 Core Concepts

### The Orchestrator

Central state machine (XState) that coordinates:

- File import and parsing
- Data mapping and transformation
- Persistence (storage)
- Validation and business rules
- Export to multiple formats
- UI updates and progress tracking

### Modules

Pluggable components implementing standard interfaces:

- **Importer**: Reads files or APIs
- **Mapper**: Transforms raw data to schema
- **Persistence**: Stores and retrieves data
- **Local Step Engine**: Row-level validations
- **Global Step Engine**: Dataset-level transforms
- **Viewer**: Formats data for UI (pagination, filtering)
- **Exporter**: Outputs to files, APIs, databases
- **Logger**: Centralized observability

### Streams

Non-blocking data pipes (`ReadableStream`, `TransformStream`) that keep UI responsive while processing.

### Observables

Real-time reactive updates via RxJS and Preact Signals for state, context, metrics, and progress.

---

## 🎯 Why ETL CoreStream Wins

| Feature                | Benefit                                    |
| ---------------------- | ------------------------------------------ |
| **Streams**            | Process any file size with constant memory |
| **Headless**           | Use any UI framework, any storage backend  |
| **Modular**            | Load only what you need, swap freely       |
| **Async**              | Backend integration without blocking       |
| **Real-time**          | Edit, validate, transform instantly        |
| **Non-blocking**       | Users stay productive during processing    |
| **Observable-based**   | Reactive updates, framework-agnostic       |
| **Resource-conscious** | Excels in containers, edge, client-side    |
| **Typesafe**           | TypeScript interfaces enforce contracts    |
| **Tested**             | XState path-based integration tests        |

---

## 🌐 Deployment Options

ETL CoreStream is **environment-agnostic**. Build custom modules to deploy anywhere:

**Browser**

- Implement IndexedDB persistence, file API importers, API exporters
- Instant import and export with real-time editing

**Node.js / Deno**

- Implement file system persistence, database adapters, scheduled pipelines
- SQLite, PostgreSQL, or cloud database integration

**Edge Workers**

- Implement Cloudflare Workers, AWS Lambda exporters
- Stream data to cloud storage with real-time transformations

**Docker / Kubernetes**

- Implement containerized modules with minimal resource overhead
- Scales horizontally via service architecture

**Microservices**

- Implement as a service module exposing REST/GraphQL APIs
- Connect to message queues via custom exporters

**The power is yours:** Implement the interfaces you need for your environment. One core engine, infinite deployment possibilities.

---

## 📖 Documentation

Full documentation includes:

- **Architecture deep-dive**: Stream-based design, XState patterns, module contracts
- **API reference**: All public methods, observables, and interfaces
- **Adapter templates**: Quickstart guides for custom importers, persistence, exporters
- **Testing guide**: Path-based integration tests with XState
- **Performance tips**: Best practices for large files and resource-constrained environments
- **Examples**: React, Vue, Node.js, browser-native implementations

### How-to guides (docs/)

The repository also includes a set of "how-to" guides in the `docs/` folder with practical recipes and examples. Quick index:

- [How to create a layout (layout-base)](docs/how-to-create-layout.md)
- [How to create Steps (local & global)](docs/how-to-create-steps.md)
- [How to create local transforms](docs/how-to-create-local-transforms.md)
- [How to create local validators](docs/how-to-create-local-validators.md)
- [How to create a global validator](docs/how-to-create-global-validator.md)
- [How to create a global transform](docs/how-to-create-global-transform.md)
- [How to handle Mapping](docs/how-to-handle-mapping.md)
- [How to create your own module](docs/how-to-create-module.md)
- [How to create an Export](docs/how-to-create-export.md)
- [How to edit or remove rows during processing](docs/how-to-edit-remove-rows.md)
- [How to implement ETL in the web (browser)](docs/how-to-implement-web.md)

See the `docs/` directory for full details and examples.

---

## 🤝 Contributing

ETL CoreStream is built for the community. Contributions welcome:

- New adapter implementations
- Performance improvements
- Bug fixes and tests
- Documentation enhancements
- Real-world use case examples

---

## 💡 What Makes ETL CoreStream Different?

Most ETL tools freeze your UI. They load everything into memory. They're opinionated and rigid. ETL CoreStream breaks that pattern:

- **Stream-first architecture**: Never freeze your UI again
- **Constant memory footprint**: Gigabyte files on low-spec devices
- **Zero framework deps**: Work with React, Vue, Svelte, or vanilla JS
- **Swap any layer**: Custom importers, persistence, validators—at runtime
- **Backend-ready**: Async transforms and validations connect to APIs
- **Real-time editing**: Changes flow through validation/transform immediately
- **Container-friendly**: Designed for Docker and edge environments

**This is the ETL solution built for the modern web.**

---

## 🚀 Ready to Transform Your Data?

```bash
npm install @etl-corestream/core
```

Build amazing data processing experiences. Keep your UI responsive. Handle massive files effortlessly.

**Let ETL CoreStream power your next project.**
