# ETL CoreStream - Collaboration Guidelines

Welcome! We're excited that you're interested in contributing to **`etl-corestream/core`**, a modular, headless, performance-focused ETL orchestration library. This document outlines the guidelines and best practices for collaborating with us.

## 🎯 Project Overview

**`etl-corestream/core`** is:

- **Headless**: No UI framework dependencies; compose with adapters for any deployment
- **Modular**: Swap any module (importer, persistence, exporter, etc.) via the `ProviderModule` dependency injector
- **Stream-based**: Uses `ReadableStream` pipes for responsive, non-blocking data processing
- **Performance-first**: Respects user and system resources (memory, CPU, storage, network)

Before contributing, familiarize yourself with [`ARCHITECTURE.md`](./ARCHITECTURE.md) to understand the design principles, stream-based architecture, and observability patterns.

---

## 📋 How to Contribute

We welcome contributions in the following areas:

### 1. **Bug Reports**

- Found a bug? Please create an issue with:
  - Clear description of the problem
  - Steps to reproduce
  - Expected vs. actual behavior
  - Environment (Node version, OS, browser, etc.)
  - Include relevant logs or error messages

### 2. **Feature Requests & Enhancements**

- Want to add new functionality?
- **Before starting, open an issue or discussion** to:
  - Describe the feature
  - Explain the use case
  - Discuss the implementation approach
  - Ensure alignment with project goals (headless, modular, performance-focused)

### 3. **Core Module Contributions**

- Adding a new core module (importer, persistence layer, validator, etc.)?
- Ensure it:
  - Implements the appropriate interface (`i-*.ts`)
  - Follows stream-based design principles
  - Includes comprehensive unit tests
  - Handles chunking and resource efficiency (see guidelines below)

### 4. **Adapter Creation**

- Building a UI adapter (React, Vue, Svelte)?
- Creating a persistence adapter (PostgreSQL, SQLite, file-based)?
- Creating an importer/exporter adapter?
- **Adapters are always external repositories** (this is a headless library with no framework/backend dependencies)
- Always reference the orchestrator interfaces and link back to ETL CoreStream
- Publish as your own package or repository

### 5. **Documentation & Examples**

- Improving ARCHITECTURE.md, README.md, or adding guides?
- Adding code examples or tutorials?
- Creating integration examples with popular frameworks?
- All contributions welcome!

### 6. **Forks for Specialization**

- Need significant customizations for your use case?
- Feel free to fork the repository
- **Please link back to this repository in your README for credit**
- If your fork becomes broadly useful, consider:
  - Contributing back to core (if non-disruptive)
  - Publishing as a standalone adapter/package

---

## 🏗️ Architecture & Design Principles

Before contributing, understand these core principles:

### Stream-Based Processing

- **Always use `ReadableStream`** for data transformations and bulk operations
- **Never** load entire datasets into memory
- Use `TransformStream` to compose validations, mappings, or filtering
- Process data in **chunks**; emit early transition events when appropriate

### Non-Blocking Reactivity

- Use `processingRows` flag to indicate background work without blocking user actions
- Support early UI unlocking via events like `FIRST_CHUNK_RAW_READY`
- Expose observables (`state$`, `context$`, `metrics$`, `progress$`) and signals for consumers
- Cancellation via `AbortSignal` is essential for long-running operations

### Modularity & Interfaces

- All modules implement `i-*.ts` interfaces (e.g., `IImporter`, `IPersistence`, `IMapper`)
- The `ProviderModule` is the single composition point for dependency injection
- Never hardcode external dependencies; accept them via constructor or configuration
- **External dependencies are acceptable if justified**: core uses RxJS (observables), xstate (state management), Preact Signals (reactivity)
- Avoid framework-specific dependencies (React, Vue, Angular) in core; use adapters instead

### Resource Efficiency

- **Memory**: Constant footprint regardless of dataset size (streaming + pagination)
- **CPU**: Non-blocking operations, chunked processing, early transitions
- **Storage**: Indexed queries, minimal duplication, lazy metrics
- **Network**: Chunked transfer, pagination, cancellation support

---

## 📝 Contributing to Core

If your contribution directly impacts **this repository's core**, follow these guidelines:

### Unit Tests (Required)

**All new code must include comprehensive unit tests.** This is non-negotiable.

#### Testing Guidelines

- **File naming**: `*.test.ts`
- **Framework**: Vitest
- **Scope**: Test your changes, not existing functionality (unless fixing bugs)
- **Coverage**: Aim for reasonable coverage of your new code
- **Test cases** should include:
  - Happy path scenarios
  - Edge cases (empty data, large datasets, null/undefined values)
  - Error handling and recovery
  - Stream behavior (completion, backpressure, cancellation)
  - Chunking and resource constraints

#### Example: Testing a Global Validator

```ts
// src/core/global-step-engine/validators/my-validator.test.ts
import { describe, it, expect } from "vitest";
import { MyValidator } from "./my-validator";

describe("MyValidator", () => {
  it("should validate rows in chunks without loading all into memory", async () => {
    const validator = new MyValidator();
    const rows = generateRows(10000);
    const chunks: any[] = [];

    // Create a mock stream
    const stream = rowsToStream(rows);
    const result = validator.validate(stream);

    for await (const chunk of result) {
      chunks.push(chunk);
      // Verify memory usage is constant (example using process.memoryUsage())
    }

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.every((c) => c.rows.length > 0)).toBe(true);
  });

  it("should respect AbortSignal for cancellation", async () => {
    const validator = new MyValidator();
    const abortController = new AbortController();
    const stream = infiniteStream(); // Never-ending stream

    const resultPromise = validator.validate(stream, abortController.signal);

    setTimeout(() => abortController.abort(), 100);

    await expect(resultPromise).rejects.toThrow("abort");
  });

  it("should emit progress updates for long-running validations", async () => {
    const validator = new MyValidator();
    const progressUpdates: string[] = [];

    validator.on("progress", (label, percent) => {
      progressUpdates.push(`${label}: ${percent}%`);
    });

    const stream = rowsToStream(generateRows(1000));
    await validator.validate(stream);

    expect(progressUpdates.length).toBeGreaterThan(0);
  });
});
```

#### Run Tests

```bash
npm test                      # Run all tests
npm test -- --watch          # Watch mode
npm test -- path/to/file     # Test specific file
npm test -- --coverage       # Coverage report
```

### Backward Compatibility

**Do not break the existing public API** without strong justification.

#### Rules

1. **Public methods and interfaces must remain stable**
   - If you need to change a public method, follow a deprecation period:
     - Keep the old method, mark it as `@deprecated`
     - Add the new method with the improved signature
     - Document migration path
     - Remove in the next major version

2. **Module interfaces (`i-*.ts`) are contracts**
   - Changing interface signatures breaks all implementations
   - If you must change an interface, add new methods without removing old ones (if possible)
   - Bump major version number

3. **Observable/Signal emissions must be consistent**
   - Don't change the shape of emitted objects without versioning
   - Document any shape changes clearly

#### Example: Backward-Compatible Change

```ts
// ❌ Breaking change - don't do this
export interface IImporter {
  readFileStream(
    file: File,
    signal: AbortSignal,
    newParam: string
  ): Promise<[ReadableStream, number]>;
  // Old signature is gone!
}

// ✅ Backward-compatible change - do this
export interface IImporter {
  readFileStream(
    file: File,
    signal: AbortSignal,
    newParam?: string
  ): Promise<[ReadableStream, number]>;
  // Optional parameter is backward-compatible
}

// Or, if truly disruptive:
export interface IImporter {
  /**
   * @deprecated Use readFileStreamV2 instead. Will be removed in v3.0.0.
   */
  readFileStream(file: File, signal: AbortSignal): Promise<[ReadableStream, number]>;

  readFileStreamV2(
    file: File,
    signal: AbortSignal,
    newParam: string
  ): Promise<[ReadableStream, number]>;
}
```

### Code Style & Structure

- **Language**: TypeScript for type safety
- **Module organization**: Follow existing structure (`src/core/[module]/`)
- **Naming**: Clear, meaningful names for variables, functions, classes
- **Comments**: Only for non-obvious intent or trade-offs (avoid narrating what code does)
- **Stream methods**: Use verb-based names (`readFileStream`, `saveStream`, `handleStream`, `getRowsStream`)

#### Example Module Structure

```
src/core/my-module/
├── i-my-module.ts           # Interface
├── main.ts                  # Implementation
├── main.test.ts             # Unit tests
├── schemes/                 # Shared types (if any)
│   └── my-types.ts
└── adapters/                # Optional: adapter implementations
    ├── adapter-a.ts
    └── adapter-b.ts
```

### Global Validators & Transforms: Chunking Rules

**Never** load all rows into memory for global validation or transformation. This is critical.

#### ✅ Correct: Chunk-Based Processing

```ts
export class MyGlobalValidator implements IGlobalStepEngine {
  async handleStep(
    stream: ReadableStream,
    step: GlobalStep,
    signal: AbortSignal
  ): Promise<ReadableStream> {
    return stream.pipeThrough(
      new TransformStream({
        async transform(chunk, controller) {
          // Process only this chunk, not entire dataset
          const { rows, errors } = chunk;
          const validated = await this.validateBatch(rows); // Batch operation

          controller.enqueue({ rows: validated, errors });
        },
      })
    );
  }

  private async validateBatch(rows: RowObject[]): Promise<RowObject[]> {
    // Process rows in the batch without loading more
    return rows.map((row) => {
      if (this.isValid(row)) {
        return row;
      }
      throw new ValidationError(row);
    });
  }
}
```

#### ❌ Incorrect: Loading All Rows

```ts
export class BadGlobalValidator implements IGlobalStepEngine {
  async handleStep(
    stream: ReadableStream,
    step: GlobalStep,
    signal: AbortSignal
  ): Promise<ReadableStream> {
    // THIS IS WRONG - DO NOT DO THIS
    const allRows: RowObject[] = [];
    const reader = stream.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      allRows.push(...value.rows); // Loading entire dataset!
    }

    // Now we have memory explosion on large files
    const validated = allRows.map((row) => this.validate(row));

    // ... more problematic code
  }
}
```

### Schema Changes

If you modify any schema in `src/shared/schemes/`:

1. **Version the schema** (e.g., `layout.v2.ts`)
2. **Provide migration helpers** (e.g., `migrateLayoutV1ToV2()`)
3. **Document the migration** in `docs/migration.md`
4. **Add migration tests** to verify backward compatibility paths

---

## 🔄 Pull Request Process

1. **Fork or branch** from main
   - Use descriptive branch names: `feat/csv-export`, `fix/orchestrator-memory-leak`, `docs/add-adapter-guide`

2. **Create your changes** following guidelines above

3. **Test thoroughly**

   ```bash
   npm test                      # All tests pass
   npm run build                 # Build succeeds
   npm run lint                  # No linting errors (if applicable)
   ```

4. **Commit with clear messages**

   ```
   feat(global-validator): add chunked validation for large datasets

   - Process rows in batches to maintain constant memory footprint
   - Add progress tracking for long-running validations
   - Support AbortSignal for cancellation

   Fixes #123
   ```

5. **Push and create a PR** with:
   - Clear title and description
   - What problem does this solve?
   - How does it work?
   - Any breaking changes?
   - Testing performed
   - Link to related issues/discussions

6. **PR Review Expectations**
   - Tests must pass
   - No regressions in existing functionality
   - Code follows project style
   - Performance impact is minimal
   - Resource efficiency is maintained (no loading entire datasets, etc.)

---

## 🧩 Adding Modules to Core vs. Creating External Adapters

### Decide: Core Module or External Adapter?

| Aspect           | Core Module                                                | External Adapter                                               |
| ---------------- | ---------------------------------------------------------- | -------------------------------------------------------------- |
| **Location**     | This repository (`src/core/`)                              | Separate repository                                            |
| **Use case**     | General ETL operations (import, persist, export, validate) | Framework/tool integration (React, Vue, PostgreSQL, AWS, etc.) |
| **Scope**        | Implements `i-*.ts` interface                              | Wraps core modules or exports for framework consumption        |
| **Dependencies** | Justified only (no framework-specific deps)                | May depend on external libraries                               |
| **Versioning**   | Core versioning                                            | Independent versioning                                         |
| **Publishing**   | npm as `etl-corestream`                                    | npm as `@org/adapter-name`                                     |
| **Example**      | Global step validator, CSV importer                        | React hooks adapter, PostgreSQL persistence                    |

### Adding to Core

If your module:

- Implements a `i-*.ts` interface
- Solves a general ETL problem (not tool-specific)
- Provides value to most users
- Is performant and resource-efficient

**Then propose it as a core module:**

1. Open an issue describing the module
2. Discuss design and interface compliance
3. Submit PR with full test coverage
4. Get approval from maintainers

#### About External Dependencies in Core

Core modules **can depend on external packages** if justified. Currently, core depends on:

- **xstate**: State machine orchestration (essential for complex workflows)
- **RxJS**: Observable-based reactivity and composition patterns
- **Preact Signals**: Fine-grained reactive state management

**Justification criteria for adding new dependencies:**

1. **Solves a fundamental problem** that can't be solved with existing dependencies
2. **Zero framework bias** (no React, Vue, Angular, Svelte, etc.)
3. **Small footprint** or widely adopted (prefer popular, well-maintained packages)
4. **Clear value** in the PR discussion - explain why it's worth the dependency
5. **Unavoidable** - can't be made optional or deferred to adapters

**Never add dependencies for:**

- Framework integration (use adapters instead)
- Backend-specific drivers (use adapters instead)
- Nice-to-have features (keep core lean)

### Creating an Adapter

If your module:

- Integrates with a specific framework (React, Vue, Svelte)
- Connects to a specific backend (PostgreSQL, Firebase, AWS)
- Is niche or domain-specific
- Might be versioned independently

**Then create as an external adapter repository:**

1. Create your own repository (separate from ETL CoreStream)
2. Implement the orchestrator interfaces in your adapter
3. **In your repository's README and package.json, reference ETL CoreStream**
4. Follow the same code style and testing practices
5. Publish as a standalone package

#### Example: Publishing an Adapter Separately

````
# Your adapter repository (independent)
my-adapter-etl-corestream/
├── src/
│   ├── react-hooks/          # Adapter implementation
│   │   └── useOrchestrator.ts
│   └── persistence-postgres/ # Custom persistence
│       └── main.ts
├── README.md                  # With ETL CoreStream reference
├── package.json               # With ETL CoreStream peer dependency
└── tests/

# In your README:
# My ETL CoreStream React Adapter

This package provides React hooks and PostgreSQL persistence for [ETL CoreStream](https://github.com/crist.../ETL-CoreStream).

## Installation

```bash
npm install @myorg/etl-corestream-react-postgres etl-corestream
````

## Usage

See ETL CoreStream [ARCHITECTURE.md](https://github.com/crist.../ETL-CoreStream/blob/main/ARCHITECTURE.md) for core concepts.

```

# In your package.json:
{
  "name": "@myorg/etl-corestream-react-postgres",
  "version": "1.0.0",
  "description": "React hooks and PostgreSQL adapter for ETL CoreStream",
  "repository": "myorg/etl-corestream-react-postgres",
  "keywords": ["etl-corestream", "adapter", "react", "postgresql"],
  "peerDependencies": {
    "etl-corestream": "^1.0.0",
    "react": "^18.0.0"
  }
}
```

### Disruptive Changes & Forks

If you need to make **significant, incompatible changes** to core architecture:

1. **Fork the repository**
2. Make your changes
3. **In your fork's README, include:**

   ```markdown
   ## About This Fork

   This is a fork of [ETL CoreStream](link-to-original) with [describe major changes].

   ### Differences from Upstream

   - [Change 1]
   - [Change 2]

   ### Credit

   Original project by [original maintainers]. Built on ETL CoreStream's stream-based architecture.
   ```

4. Feel free to publish as your own package if it solves a specific need
5. Consider contributing back non-disruptive parts to core

---

## 📚 Code Examples & Testing

When proposing new functionality, **always include examples**:

1. **Unit test demonstrating the feature**
2. **Example showing how to use it**
3. **Performance benchmark** (if relevant)

### Example Template

```ts
// Example: Creating a Custom Importer

// 1. Define the interface
export interface IMyCustomImporter extends IImporter {
  readFileStream(file: File, signal: AbortSignal): Promise<[ReadableStream, number]>;
}

// 2. Implement it
export class MyCustomImporter implements IMyCustomImporter {
  async readFileStream(file: File, signal: AbortSignal): Promise<[ReadableStream, number]> {
    // Parse file into stream
    // Estimate total rows
    // Return [stream, estimate]
  }
}

// 3. Test it
describe("MyCustomImporter", () => {
  it("should stream rows without loading entire file", async () => {
    const importer = new MyCustomImporter();
    const file = new File(
      [
        /* data */
      ],
      "test.csv"
    );
    const [stream, estimate] = await importer.readFileStream(file, new AbortController().signal);

    let rowCount = 0;
    for await (const chunk of stream) {
      rowCount += chunk.rows.length;
    }

    expect(rowCount).toBeGreaterThan(0);
    expect(estimate).toBeCloseTo(rowCount, -1); // Close estimate
  });
});

// 4. Show usage
const provider = new ProviderModule({
  modules: {
    importer: new MyCustomImporter(),
    // ... other modules
  },
});

orchestrator.initialize(provider);
orchestrator.selectFile(csvFile);
```

---

## ❓ Questions or Need Help?

- **Open a discussion** for questions about contributing
- **Check existing issues** before creating duplicates
- **Reference ARCHITECTURE.md** when discussing design
- Be respectful and constructive in all communications

---

## 🙏 Thank You!

Your contributions make ETL CoreStream better for everyone. Whether it's a bug report, a new module, an adapter, or just improving documentation, we appreciate your effort.

**Happy coding!**
