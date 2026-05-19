# ETL CoreStream

<div align="center">

## Reactive stream-based ETL engine for massive data workflows

Process gigabyte-scale files without freezing the UI, exhausting memory, or blocking user interaction.

Built for resumable imports, async validation pipelines, real-time editing, and fully modular orchestration.

<br/>

![npm version](https://img.shields.io/npm/v/@etl-corestream/core)
![license](https://img.shields.io/npm/l/@etl-corestream/core)
![typescript](https://img.shields.io/badge/TypeScript-Ready-blue)
![streams](https://img.shields.io/badge/Streams-First-00b894)
![browser](https://img.shields.io/badge/Browser-Friendly-orange)
![architecture](https://img.shields.io/badge/Architecture-Modular-purple)
![status](https://img.shields.io/badge/status-active_development-yellow)

</div>

---

> **⚠️ Disclaimer — under active development**
>
> ETL CoreStream is currently under heavy development and is **not stable yet**.
> Until version `1.0.0`, APIs, behaviors, and internal architecture may change without notice.
>
> Expect breaking changes while the project evolves toward a stable v1 release.

---

# 📚 Table of Contents

- [Features](#-core-features)
- [Why ETL CoreStream?](#-why-etl-corestream)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Layout-Driven Architecture](#-layout-driven-architecture)
- [Local Transform Pipelines](#-local-transform-pipelines)
- [Local Validation Pipelines](#-local-validation-pipelines)
- [Async Global Validation Pipelines](#-async-global-validation-pipelines)
- [Async Global Transform Pipelines](#-async-global-transform-pipelines)
- [Persistent & Resumable Workflows](#-persistent--resumable-workflows)
- [Export System](#-export-system)
- [Processing Pipeline](#-processing-pipeline)
- [Architecture Overview](#-architecture-overview)
- [Fully Modular Architecture](#-fully-modular-architecture)
- [Reactive by Design](#-reactive-by-design)
- [Performance Characteristics](#-performance-characteristics)
- [The 1GB Challenge](#-the-1gb-challenge)
- [Capability Comparison](#-capability-comparison)
- [Deployment Flexibility](#-deployment-flexibility)
- [Documentation & Examples](#-documentation--examples)
- [Official Adapters](#-official-adapters)
- [Use Cases](#-use-cases)
- [Design Philosophy](#-design-philosophy)
- [Open Source](#-open-source)
- [Current Status](#-current-status)
- [License](#-license)

# ✨ Core Features

- Stream-first architecture
- Constant memory footprint
- Massive file processing
- Resumable ETL sessions
- Real-time editable datasets
- Persistent recoverable workflows
- Async backend-aware validation pipelines
- Async transforms & mapping
- Layout-driven processing
- Header remapping & aliases
- Headless & framework agnostic
- Signals + RxJS reactive state
- Fully modular dependency injection
- Replaceable orchestrator architecture
- Custom importers/exporters
- Export streams support
- Browser-first architecture
- Open source & extensible

---

# 🚀 Why ETL CoreStream?

Traditional browser ETL solutions usually:

- Load entire files into memory
- Freeze the UI during processing
- Lose progress after refreshes/crashes
- Lack async validation pipelines
- Become unusable with large datasets
- Are tightly coupled to specific frameworks
- Cannot recover interrupted workflows

ETL CoreStream solves this with a **reactive stream-first architecture** designed for modern large-scale data workflows.

Users can:

- Import massive files while keeping the UI responsive
- Edit rows during processing
- Resume interrupted imports
- Persist datasets locally
- Revalidate incrementally
- Connect validators/transforms directly to backend services
- Export results to files, streams, APIs, or cloud providers
- Replace internal modules with custom implementations

---

# 🚀 Installation

```bash
npm install @etl-corestream/core
```

---

# ⚡ Quick Browser Implementation

ETL CoreStream ships with a browser-oriented preset architecture that provides a ready-to-use ETL pipeline using:

* PapaParse importer
* IndexedDB persistence
* Recovery engine
* Validation engines
* Export system
* Reactive viewer
* Stream processing pipeline
## Quick Example

```ts
import { ETLBrowserOrchestrator } from "@etl-corestream/core/examples";
import { LayoutExample } from "@etl-corestream/core/examples";

// Minimal quickstart
const orchestrator = ETLBrowserOrchestrator();

orchestrator.selectLayout(LayoutExample);

await orchestrator.selectFile(file);

await orchestrator.export("Export Just Name and Email", "File");
```

This quick example shows the minimal flow to get started. See "Advanced Browser Configuration" for tuning.

## Advanced Browser Configuration

```ts
import { ETLBrowserOrchestrator } from "@etl-corestream/core/examples";
import { LayoutExample } from "@etl-corestream/core/examples";

// Create orchestrator with advanced options
const orchestrator = ETLBrowserOrchestrator({
  importer: {
    worker: true,
    importerChunkSize: 1024 * 1024 * 5,
  },

  persistence: {
    chunkSizeQtd: 50,
  },

  recover: {
    checkRecoveryPoint: true,
  },
});

// Select layout
orchestrator.selectLayout(LayoutExample);

// Observe reactive state
orchestrator.state$.subscribe(console.log);

orchestrator.progress$.subscribe(console.log);

// Start processing
await orchestrator.selectFile(file);

// Edit rows while processing continues
orchestrator.editRow(rowId, "email", "new@email.com");

// Export anytime
await orchestrator.export(
  "Export Just Name and Email",
  "File"
);
```

The entire pipeline remains reactive and non-blocking during processing.

---

# 🧠 Layout-Driven Architecture

ETL CoreStream uses layouts to define how files should be interpreted and processed.

Layouts define:

* Headers
* Header aliases
* Header remapping
* Required fields
* Local validators
* Local transforms
* Global validators
* Global transforms
* Export rules
* Entity creation logic

```ts
export const LayoutExample: LayoutBase = {
  id: "contact-management-layout-v1",

  name: "Contact Management Layout",

  description:
    "Example layout for processing contact information",

  allowUndefinedColumns: false,

  headers: [
    {
      key: "name",
      label: "Full Name",
      alternativeKeys: ["fullname", "nombre"],
      required: true,
    },

    {
      key: "email",
      label: "Email Address",
      alternativeKeys: ["correo", "contact_email"],
      required: true,
    },
  ],

  localSteps: [
    {
      id: "email-processing",

      name: "Email Processing",

      order: ["transforms", "validators"],

      transforms: [
        trim("email"),
        toLowerCase("email"),
      ],

      validators: [
        required("email"),
        email("email"),
      ],
    },
  ],

  globalSteps: [
    {
      name: "Global Validation",

      order: ["validators"],

      validators: [
        AsyncValidateDataExample(),
      ],
    },
  ],

  exports: [
    {
      name: "Export Just Name and Email",

      fn: (row) => ({
        name: row?.value?.name,
        email: row?.value?.email,
      }),
    },
  ],
};
```

This keeps ETL workflows declarative, reusable, and independent from parsing logic.

---

# 🎯 Use Cases

Common use cases where ETL CoreStream excels:

- Massive CSV imports
- CRM imports
- ERP migration pipelines
- Browser-side ETL apps
- Data cleaning interfaces
- AI enrichment pipelines
- Streaming exports
- Incremental validation systems
- Recoverable import workflows

---

# 🔄 Local Transform Pipelines

Local transforms run at row level and are ideal for normalization and lightweight transformations.

```ts
export const toLowerCase = (
  headerKey: string
): LocalStepTransform => ({
  headerKey,

  name: "toLowerCase",

  fn: (value: string) => value.toLowerCase(),
});

export const trim = (
  headerKey: string
): LocalStepTransform => ({
  headerKey,

  name: "trim",

  fn: (value: string) => value.trim(),
});
```

Perfect for:

* String normalization
* Cleanup
* Parsing
* Date formatting
* Entity preparation

---

# ✅ Local Validation Pipelines

Local validators run synchronously for immediate row-level feedback.

```ts
export const minValue = (
  headerKey: string,
  min: number
): LocalStepValidator => ({
  headerKey,

  name: "Min Value",

  args: [min],

  fn: (
    value: string,
    row: any,
    minVal: number
  ) => {
    const numValue = parseFloat(value);

    const isValid = numValue >= minVal;

    return {
      isValid,

      validationCode: "MIN_VALUE",

      message: !isValid
        ? `Value must be at least ${minVal}`
        : undefined,

      value,

      step: "local",
    };
  },
});
```

Ideal for:

* Required validations
* Numeric ranges
* Regex validation
* Formatting checks
* Immediate UI feedback

---

# 🌐 Async Global Validation Pipelines

Global validators can run asynchronously and integrate directly with APIs or backend services.

```ts
export const AsyncValidateDataExample =
  (): GlobalStepValidator => ({
    name: "AsyncValidateDataExample",

    fn: async (rows: RowObject[]) => {
      const validationResults =
        await validateDataExample(
          rows.map((row) => ({
            id: row.__rowId,
            value: row.value["headerKey"],
          }))
        );

      return {
        validationErrors:
          validationResults
            .filter((result) => !result.isValid)
            .map((result) => ({
              __rowId: result.id,

              headerKey: "headerKey",

              validationCode:
                result.validationCode,

              message: result.message,

              step: "AsyncValidateDataExample",
            })),

        removedValidationErrors: [],
      };
    },
  });
```

This enables:

* Backend-aware validation
* Batch validation APIs
* Database checks
* Cross-row validation
* External business rule engines

---

# 🔁 Async Global Transform Pipelines

Global transforms allow asynchronous dataset-wide transformations.

```ts
export const AsyncTransformDataExample =
  (): GlobalStepTransform => ({
    name: "AsyncTransformDataExample",

    fn: async (rows: RowObject[]) => {
      const transformedItems =
        await transformDataExample(
          rows.map((row) => ({
            id: row.__rowId,
            value: row.value["headerKey"],
          }))
        );

      const rowMap = new Map(
        rows.map((r) => [r.__rowId, r])
      );

      transformedItems.forEach((item) => {
        const row = rowMap.get(item.id);

        if (row) {
          row.value["headerKey"] =
            item.value;
        }
      });
    },
  });
```

Perfect for:

* Backend enrichment
* AI processing
* Data normalization
* Entity synchronization
* Cross-dataset transformations

---

# 💾 Persistent & Resumable Workflows

ETL CoreStream supports persistent ETL sessions.

Imports can continue after:

* Browser refreshes
* Crashes
* Tab closures
* Interrupted processing

Users can edit imported rows while processing continues in the background.

## Persistence Capabilities

* Resume interrupted imports
* Restore previous sessions
* Persist partially processed datasets
* Incremental reprocessing
* Editable persisted data
* Recoverable ETL workflows

```ts
const orchestrator = ETLBrowserOrchestrator({
  recover: {
    checkRecoveryPoint: true,
  },

  persistence: {
    chunkSizeQtd: 50,
  },
});
```

Long-running imports become safe, recoverable, and interactive.

---

# 📤 Export System

ETL CoreStream exporters can export directly to:

* Files
* Streams
* APIs
* Cloud providers
* Custom destinations

The exporter system can also expose a `ReadableStream` directly, allowing you to consume transformed data without implementing a custom exporter.

```ts
await orchestrator.export(
  "Export Just Name and Email",
  "Stream"
);
```

This makes it possible to:

* Pipe exports to APIs
* Upload directly to cloud storage
* Send data through WebSockets
* Stream data into another ETL pipeline
* Build custom exporters externally

---

# 🔁 Processing Pipeline

Typical processing flow inside ETL CoreStream:

File
 ↓
Importer
 ↓
Mapper
 ↓
Local Steps Engine (row-level transforms & validators)
 ↓
Persistence (chunked storage / indexedDB)
 ↓
Global Steps Engine (dataset-level transforms & validators)
 ↓
Exporter / Viewer

This diagram highlights the runtime flow from raw file input to export/view output and clarifies where modules can be swapped.


# 🏗️ Architecture Overview

```text
                          ┌────────────────────┐
                          │      Provider      │
                          │ Dependency Injector│
                          └─────────┬──────────┘
                                    │
                    Injects replaceable modules
                                    │

┌───────────────────────────────────────────────────────────────┐
│                                                               │
│                        Orchestrator                           │
│                    (replaceable module)                      │
│                                                               │
└───────────────┬───────────────────────────────────────────────┘
                │

     ┌──────────┼──────────┬──────────┬──────────┬──────────┐
     ↓          ↓          ↓          ↓          ↓          ↓

┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│Importer│ │ Mapper │ │Persist │ │Recover │ │ Viewer │ │ Logger │
│replace │ │replace │ │replace │ │replace │ │replace │ │replace │
└────┬───┘ └────┬───┘ └────┬───┘ └────┬───┘ └────┬───┘ └────────┘
     │           │          │          │          │
     └───────────┼──────────┼──────────┼──────────┘
                 │
                 ↓

    ┌───────────────────────────────────────────────┐
    │           Local Steps Engine                  │
    │    Validators + Transforms (row-level)       │
    └─────────────────┬─────────────────────────────┘
                      ↓

    ┌───────────────────────────────────────────────┐
    │          Global Steps Engine                  │
    │ Validators + Transforms (dataset-level)      │
    └─────────────────┬─────────────────────────────┘
                      ↓

               ┌──────────────┐
               │   Exporter   │
               │   replace    │
               └──────┬───────┘
                      ↓

           File / Stream / API / Cloud
```

---

# 🧩 Fully Modular Architecture

Every internal module can be replaced.

Including:

* Orchestrator
* Importer
* Mapper
* Persistence
* Recover module
* Viewer
* Logger
* Exporter
* Local Steps Engine
* Global Steps Engine
The `Provider` is the composition root of the system. It is responsible for dependency injection, module registration, and orchestration wiring.

As long as interfaces are respected, any module can be replaced with a custom implementation.

```ts
const provider = new ProviderModule({
  importer: {
    module: CustomCSVImporter,
  },

  persistence: {
    module: PostgresPersistence,
  },

  exporter: {
    module: S3Exporter,
  },
});

const orchestrator =
  new CustomOrchestratorModule();

orchestrator.initialize(provider);
```

This allows developers to build entirely custom ETL ecosystems while preserving compatibility with the CoreStream pipeline architecture.

---

# ⚛️ Reactive by Design

ETL CoreStream exposes reactive state through:

* RxJS Observables
* Preact Signals

Compatible with:

* React
* Vue
* Angular
* Svelte
* SolidJS
* Vanilla JS

```ts
orchestrator.state$.subscribe(console.log);

orchestrator.progress$.subscribe(console.log);

orchestrator.metrics$.subscribe(console.log);

const state = orchestrator.state;

const metrics = orchestrator.metrics;
```

---

# 📊 Performance Characteristics

ETL CoreStream is designed for massive datasets and constrained environments.

## Memory

* Constant memory footprint
* Chunk-based processing
* Stream pipelines
* Lazy pagination
* Minimal duplication

## CPU

* Non-blocking processing
* UI-safe architecture
* Incremental updates
* Background pipelines

## Storage

* Indexed persistence
* Recoverable sessions
* Incremental synchronization

## Network

* Async backend integration
* Chunked transfers
* Cancellable operations

---

# 📈 The 1GB Challenge

While many browser ETL tools crash or freeze processing large datasets, ETL CoreStream keeps processing incrementally while maintaining responsive interaction.

Users can:

* Navigate pages
* Edit rows
* Trigger exports
* Apply filters
* Continue working

Even while background processing is still running.

## Benchmark (example)

| Rows | File Size | Memory Usage | UI Freeze |
| ---- | --------- | ------------ | --------- |
| 1,000,000 | 1GB | ~constant | No |


---

# 📦 Capability Comparison

| Capability               | ETL CoreStream | Traditional Browser ETL |
| ------------------------ | -------------- | ----------------------- |
| Stream processing        | ✅              | ❌                       |
| Constant memory usage    | ✅              | ❌                       |
| Resumable imports        | ✅              | ❌                       |
| Editable datasets        | ✅              | ❌                       |
| Async backend validation | ✅              | ⚠️                      |
| Reactive state           | ✅              | ❌                       |
| Modular architecture     | ✅              | ⚠️                      |
| Replaceable orchestrator | ✅              | ❌                       |
| Real-time revalidation   | ✅              | ❌                       |
| Persistent sessions      | ✅              | ❌                       |
| Stream exports           | ✅              | ❌                       |

---

# 🌍 Deployment Flexibility

ETL CoreStream is environment-agnostic.

Build adapters for:

* Browsers
* Node.js
* Deno
* Docker
* Kubernetes
* Edge Workers
* Microservices

One orchestration engine, multiple environments.

---

# 📚 Documentation & Examples

Detailed guides and examples are available in `/docs`.

Topics include:

* Creating layouts
* Header mapping
* Local validators
* Local transforms
* Global validators
* Global transforms
* Exporters
* Persistence engines
* Browser implementations
* Recovery systems
* Async pipelines
* Editing workflows
* Custom orchestrators
* Custom modules

Additional adapters and ecosystem integrations are maintained in separate repositories.

You can also find the full set of "how-to" guides in the repository docs folder on GitHub:
[ETLCoreStream-Core/docs](https://github.com/cristianm-developer/ETLCoreStream-Core/tree/main/docs)

---

# 🔌 Official Adapters

The first official adapter is the React adapter:

- @etl-corestream/react — React integration (viewer components and helpers)

  - npm: https://www.npmjs.com/package/@etl-corestream/react
  - package: @etl-corestream/react
  - GitHub: https://github.com/cristianm-developer/ETLCoreStream-React

  Install:

  ```bash
  npm install @etl-corestream/react
  ```

---

# 🤝 Open Source

ETL CoreStream is fully open source.

You are free to:

* Fork
* Extend
* Create adapters
* Contribute
* Open issues
* Improve documentation
* Build integrations

Community contributions are welcome.

---

# 🧭 Design Philosophy

ETL CoreStream follows a small set of guiding principles:

- Streams over in-memory datasets
- Recoverability over ephemeral processing
- Composition over monolithic pipelines
- Reactive state over polling
- Incremental processing over blocking operations

These principles shape API decisions and architecture trade-offs across the project.

# 🛠️ Current Status

ETL CoreStream is evolving rapidly toward a stable v1 release.

Current priorities include:

* API stabilization
* Adapter ecosystem expansion
* Persistence optimization
* Additional exporters
* Stream optimizations
* Documentation expansion
* More recovery strategies
* Additional environment presets

