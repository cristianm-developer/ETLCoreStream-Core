# How to edit or remove rows during processing

This document describes the interactive workflow when the orchestrator finishes processing an input file and waits for user actions (edit, remove, export, or reset). It also explains how to consume the orchestrator API in `src/core/orchestrator/i-orchestrator-module.ts` to implement the UI and actions.

## End-of-processing / waiting-for-user state

When the orchestrator finishes its normal import and processing pipeline it enters the "waiting for user" phase. In code this corresponds to the `waiting-user` state and related states such as `editing-row`, `removing-row`, and `exporting`.

```2:16:e:/Developing/Web/Personal/Components/ETL CoreStream/src/core/orchestrator/schemes/orchestator-states.ts
export type OrchestatorStateType =
    | 'initializing'
    | 'waiting-layout'
    | 'waiting-file'
    | 'importing'
    | 'mapping'
    | 'handling-local-step'
    | 'persisting'
    | 'handle-global-steps'
    | 'initializing-user-view'
    | 'waiting-final-processing'
    | 'waiting-user'
    | 'editing-row'
    | 'removing-row'
    | 'exporting'
    | 'error';
```

While in `waiting-user`, the UI should present options to the user:

- Edit a specific row
- Remove a specific row
- Export the processed data (Stream or File)
- Reset the run and re-start processing

## Orchestrator consumer API (actions)

The orchestrator exposes consumer actions that the UI should call. Key methods are shown below — use them to trigger edits, removals and exports.

```39:46:e:/Developing/Web/Personal/Components/ETL CoreStream/src/core/orchestrator/i-orchestrator-module.ts
    /* actions available to consumers */
    selectFile(file: File): void;
    selectLayout(layout: LayoutBase): void;
    changePage(pageNumber: number): void;
    removeRow(rowId: number): void;
    export(id: string, target: 'Stream' | 'File'): void;
    editRow(rowId: number, key: string, value: string): void;
```

## Edit flow (single-row reprocessing)

1. User chooses "Edit" on a row. UI calls `editRow(rowId, key, value)` on the orchestrator.
2. The orchestrator transitions to `editing-row` and sets an editing marker in the context (so the UI can show the changed value and a confirmation).
3. After the user confirms the edit, the orchestrator will:
   - Re-run the _local_ steps (local transforms and validators) only for that single row. This produces updated row output and any new validation errors for that row.
   - If your integration is configured to reprocess dependent/global results (e.g. a "reprocess all rows" option), the orchestrator will then run the _global_ steps (`handle-global-steps`) so aggregated outputs and downstream transforms reflect this change.
4. The orchestrator updates its metrics (total rows, error count, other counters) and publishes the updated context/metrics to `metrics$` / `metricsSignal`.
5. UI reads the new `currentRows` / `currentErrors` and highlights the updated row and any changed metrics.

Notes:

- The edit operation should be scoped to reprocessing only the minimal necessary work (local steps) by default to be fast and predictable.
- Re-running global steps is optional and controlled by your app's configuration or a user prompt; document this choice in the UI so users know if their edit will trigger full re-aggregation.

## Remove flow

1. User chooses "Remove" on a row. UI calls `removeRow(rowId)` on the orchestrator.
2. The orchestrator transitions to `removing-row` and sets a removing marker in the context.
3. The orchestrator deletes the row from the in-memory/current persistence and from any persisted store (if applicable).
4. After removal the orchestrator updates metrics (decrement totalRows, update errorCount if applicable) and publishes the updated context/metrics.
5. UI refreshes `currentRows`, `currentErrors`, and metrics view to reflect the removal.

## Export and Reset

- `export(id, target)` triggers an export run (either streamed or written to a file). The orchestrator will move to `exporting` state while generating the export.
- `reset()` should clear persistence and return the orchestrator to an initial state so the user can select a new file or repeat the process.

## Context fields the UI can observe

Observe these context fields so the UI can reflect what is happening and show the appropriate controls and confirmations:

- `editingRow`, `removingRow`, `exporting` — markers for in-progress user operations
- `currentRows`, `currentErrors`, `currentPage`, `totalPages` — data to display in the table view
- `metrics` — the metrics object the orchestrator updates after edits/removals

```11:16:e:/Developing/Web/Personal/Components/ETL CoreStream/src/core/orchestrator/schemes/orchestator-context.ts
    metrics?: {
        totalRows: number;
        errorCount: number;
    };
    editingRow: {rowId: number, key: string, value: string} | null;
    removingRow: {rowId: number} | null;
    exporting: { id: string, target: 'Stream'| 'File' } | null;
```

## UI recommendations

- When the orchestrator is `waiting-user`, show a prominent "Edit / Remove / Export / Reset" toolbar.
- For edits, show a two-step flow: inline edit → "Confirm" button. Only call `editRow` when user confirms.
- Indicate whether edits will re-run global steps (and allow toggling the behavior).
- After any action completes, show a brief success toast and highlight the changed row(s) and updated metrics.

## Example integration checklist

- Subscribe to `state$`, `context$`, and `metrics$` to render real-time UI.
- Call `editRow(rowId, key, value)` for confirmed edits.
- Call `removeRow(rowId)` to delete rows.
- After each action, refresh the table page via `changePage(currentPage)` if necessary.
- Ensure persistence cleanup is available via `cleanPersistence()` or `reset()` when user wants to start over.

---

File created to explain the interactive edit/remove/export/reset flows and how to consume the orchestrator API.
