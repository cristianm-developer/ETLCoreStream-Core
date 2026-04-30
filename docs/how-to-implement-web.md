# How to implement ETL in the web (browser)

This guide shows a minimal, practical example for consuming the browser preset and a layout example, loading a file, observing state/progress, and exporting results. It uses the example implementations:

```38:91:src/examples/modules/browser-preset.ts
export const BrowserProviderPreset = (config?: BrowserProviderConfig) => {
    let providerConfig: IProviderModuleConfig = {
        logger: {
            module:  LoggerModule,
        },
        importer: {
            module: ImportFilePapaparseModule,
            options: {
                ...DEFAULT_IMPORT_FILE_MODULE_OPTIONS,
                ...config?.importer,
            }
        },
        // ... other modules ...
    }

    return new ProviderModule(providerConfig);
}

export const ETLBrowserOrchestrator = (config?: BrowserProviderConfig) => {
    const orchestrator = new OrchestatorModule();
    const provider = BrowserProviderPreset(config);
    orchestrator.initialize(provider);

    return orchestrator;
}
```

and a ready-made layout you can pass to the orchestrator:

```42:49:src/examples/layout/layout-example.ts
export const ContactManagementLayout: LayoutBase = {
  id: 'contact-management-layout-v1',
  name: 'Contact Management Layout',
  description: 'Complete ETL layout for processing contact information with validation and transformations',
  allowUndefinedColumns: false,
  // headers, steps, exports...
};
```

Quick steps

- Initialize the orchestrator with optional browser-specific configuration.
- Select a layout.
- Wire a file input and call selectFile(file).
- Subscribe to progress/state/context to update your UI.
- Trigger exports via orchestrator.export(exportKey, 'File' | 'Stream').

Minimal example (TypeScript, browser)

```typescript
import { ETLBrowserOrchestrator } from "src/examples/modules/browser-preset";
import { ContactManagementLayout } from "src/examples/layout/layout-example";

// 1) create orchestrator with tuned options
const orchestrator = ETLBrowserOrchestrator({
  importer: {
    // recommended: 1-10 MB for memory-constrained devices
    chunkSize: 1024 * 1024 * 5,
    worker: true,
    allowedMimetypes: ["text/csv", "text/plain"],
    maxFileSize: 1024 * 1024 * 50, // 50 MB
  },
  persistence: {
    // how many rows saved per persistence chunk (affects IPC / DB ops)
    chunkSizeQtd: 50,
  },
});

// 2) listen to state/progress/context to render UI
orchestrator.state$.subscribe((state) => {
  console.log("orchestrator state:", state);
});
orchestrator.progress$.subscribe((progress) => {
  // array of { label, value }
  console.log("progress update", progress);
});
orchestrator.context$.subscribe((ctx) => {
  // includes metrics, totalEstimatedRows, activeStream, currentRows, currentErrors...
  console.log("context", ctx);
});

// 3) set the layout the user picked
orchestrator.selectLayout(ContactManagementLayout);

// 4) wire a file input (example)
const input = document.createElement("input");
input.type = "file";
input.accept = ".csv,text/csv";
input.onchange = () => {
  const file = input.files?.[0];
  if (!file) return;
  orchestrator.selectFile(file); // starts the import -> mapping -> persist flow
};
document.body.appendChild(input);

// 5) trigger an export (downloads CSV via exporter module)
// use the export key defined in the layout (see layout.exports)
// target 'File' will call exporter.exportToCsv and prompt download
function exportCsv() {
  orchestrator.export("csvFormat", "File");
}
```

Handling Stream exports (callback)

- Some exports in layouts include a `callback` that receives the exported ReadableStream when you request a Stream export. Use target 'Stream' to run that callback and process the stream in-memory (e.g., show stats, pipe to a websocket).

Notes on configuration and tuning

- importer.chunkSize (bytes): controls chunk size used by the file reader/parser. Larger values reduce overhead but increase memory usage. Defaults to 30MB in the examples. For low-memory devices choose 1–5 MB.
- importer.worker (boolean): run parsing in a WebWorker to avoid blocking the UI. Recommended true for large files.
- importer.allowedMimetypes / maxFileSize: control allowed files and protect against huge uploads.
- persistence.chunkSizeQtd (rows): number of rows grouped per persistence operation. Smaller values reduce memory but increase DB calls; defaults to 100.
- mapping options (see mapping defaults): control preserves, remapping behavior and async remapping hooks.
- localStepEngine.maxErrorCount (or similar): stop-after thresholds for validation errors during local step processing.

Chunking and user experience

- Import happens as a pipeline: readStream -> mapping -> local steps -> persist. The orchestrator emits progress events (orchestrator.progress$) and transitions between states (orchestrator.state$).
- The persistence layer saves data in "chunks" (chunkSizeQtd rows) — this is where you can tune trade-offs between write frequency and memory footprint.
- Global steps may reprocess chunks after first-chunk-ready; expect additional CPU and persistence writes if you use heavy global steps.

Best practices

- Always use a worker for large files to keep the UI responsive.
- Restrict allowed MIME types early to avoid parsing invalid content.
- Provide visual feedback from orchestrator.progress$ and orchestrator.state$ (waiting-layout, importing, mapping, persisting, waiting-user).
- Keep export functions in layouts simple; use the provided callback when you need custom in-memory processing.

References

- Browser preset: `src/examples/modules/browser-preset.ts`
- Layout examples: `src/examples/layout/layout-example.ts`

For details about global validators and transforms see:

- `docs/how-to-create-global-validator.md`
- `docs/how-to-create-global-transform.md`
