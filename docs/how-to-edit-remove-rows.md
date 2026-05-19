# How to edit or remove rows during processing

This document explains the interactive edit/remove flows when the orchestrator reaches the editing stage. It translates the orchestrator's state-machine and public API into practical UI recommendations and integration points.

Target references:

- State machine: `src/core/orchestrator/orchestrator-native/stateMachine/states/state-machine-editing.ts`
- Orchestrator surface (signals & actions): `src/core/orchestrator/orchestrator-native/main.ts`
- Viewer module (row editing contract): `src/core/viewer/i-viewer-module.ts`

## When editing is available

The orchestrator exposes a working "editing" stage. When that stage is active the state machine adds a marker step indicating it's ready to receive user interactions. In the implementation the `"idle"` substate of the editing stage indicates the UI may allow edits, removals and exports.

Practical check (UI): enable edit/remove controls when the orchestrator's `step` signal/observable contains the editing idle step (STEPS.EDITING.IDLE).

## Orchestrator public API (what the UI calls)

The OrchestratorModule exposes both Observables/Signals and action methods for consumers. Key methods you will call from the UI:

- selectFile(file: File)
- selectLayout(layout: LayoutBase)
- changeViewFilter(filter: RowFilter | null)
- changeViewPage(pageNumber: number)
- removeRow(rowId: number)
- editRow(rowId: number, key: string, value: string)
- export(id: string, target: "Stream" | "File")
- reset()
- cleanPersistence()

You can find these implementations in the orchestrator class where the methods send user events to the state machine.

Example: methods that send user events to the machine:

```e:/Developing/Web/Personal/Components/ETLCoreStream-core/src/core/orchestrator/orchestrator-native/main.ts
  removeRow = (rowId: number): void => {
    this.actor!.send({ type: "REMOVE_ROW", rowId } as RemoveRowEvent);
  };
  export = (id: string, target: "Stream" | "File"): void => {
    this.actor!.send({ type: "EXPORT", id, exportTarget: target } as ExportEvent);
  };
  editRow = (rowId: number, key: string, value: string): void => {
    this.actor!.send({ type: "EDIT_ROW", rowId, key, value } as EditRowEvent);
  };
```

## Viewer module contract (editing)

If your UI relies on the viewer module to perform edits or fetch paginated rows, use the viewer contract:

```e:/Developing/Web/Personal/Components/ETLCoreStream-core/src/core/viewer/i-viewer-module.ts
export type EditRowPayload = {
  rowId: number;
  headerKeyEdited: string;
  newValue: any;
};

export interface IViewerModule {
  getRowsWithPagination(...): Promise<RowObject[]>;
  editRow(persistenceModule, payload: EditRowPayload, signal?): Promise<void>;
  ...
}
```

The orchestrator's editing handlers invoke the viewer/persistence/local/global step modules during an edit cycle; the UI should call the orchestrator's `editRow(...)` method rather than calling the viewer directly (the orchestrator orchestrates the reprocessing).

## Edit flow (what happens after UI calls editRow)

Sequence (high-level):

1. UI calls `orchestrator.editRow(rowId, key, value)` after user confirmation.
2. The state machine receives `EDIT_ROW` and records an edit payload in the context.
3. The machine runs a short pipeline:
   - `editingData` (editingRowHandler) — applies the raw edit (viewer/persistence interaction).
   - `localStepPipe` — re-runs local steps (transforms/validators) for the edited row.
   - `globalStepPipe` — optionally re-runs global steps that affect aggregated outputs.
4. The machine then invokes the metrics updating handler and recover-point update, then returns to the editing idle state.

Relevant state machine fragment (shows the edit lifecycle and payload assignment):

```e:/Developing/Web/Personal/Components/ETLCoreStream-core/src/core/orchestrator/orchestrator-native/stateMachine/states/state-machine-editing.ts
150:    editingRow: {
151:      entry: [
152:        raise(({ self }) => logEventGen.info(self, "Editing row", STEPS.EDITING.EDITING_ROW)),
153:        assign({ processingRows: true }),
154:        assign(({ event, context }) => {
155:          if (event.type !== "EDIT_ROW") {
156:            return context;
157:          }
158:          return {
159:            editPayload: {
160:              rowId: event.rowId,
161:              key: event.key,
162:              value: event.value,
163:            },
164:          };
165:        }),
166:        assign({ step: ({ context }) => [...context.step, STEPS.EDITING.EDITING_ROW] }),
```

And the pipeline that follows:

```e:/Developing/Web/Personal/Components/ETLCoreStream-core/src/core/orchestrator/orchestrator-native/stateMachine/states/state-machine-editing.ts
170:      states: {
171:        editingData: {
172:          invoke: {
173:            src: "editingRowHandler",
174:            ...
191:            onDone: {
192:              target: "localStepPipe",
193:            },
194:        },
195:        localStepPipe: {
196:          invoke: { src: "localStepPipeHandler", ... },
214:            onDone: {
215:              target: "globalStepPipe",
216:            },
217:        },
218:        globalStepPipe: {
221:            src: "globalStepPipeHandler",
238:            onDone: {
239:              target: "#root.working.editing.updatingMetrics",
240:            },
241:        },
```

Notes for UIs:

- The UI must confirm the edit with the user before calling `editRow(...)`.
- By default only local steps are re-run; global steps are part of the standard pipeline but behavior can be configured in your integration.
- After the pipeline finishes the orchestrator updates `metrics`, `currentRows` and pagination info.

## Remove flow (what happens after UI calls removeRow)

Sequence:

1. UI calls `orchestrator.removeRow(rowId)` (confirm with the user).
2. State machine enters `removingRow` and invokes the removingRowsHandler which removes the row from persistence.
3. When removal completes the machine triggers metrics update, recover point update, and returns to idle.

Relevant snippet:

```e:/Developing/Web/Personal/Components/ETLCoreStream-core/src/core/orchestrator/orchestrator-native/stateMachine/states/state-machine-editing.ts
113:    removingRow: {
119:      invoke: {
120:        src: "removingRowsHandler",
121:        input: ({ context, event }: { context: OrchestratorContext; event: RemoveRowEvent }) => {
122:          if (event.type !== "REMOVE_ROW") {
123:            throw new Error("Invalid event type");
124:          }
126:          return {
127:            rowId: event.rowId,
128:            persistenceModule: context.modules!.persistence!,
129:          } satisfies RemovingRowsHandlerInput;
130:        },
138:        onDone: {
139:          target: "#root.working.editing.updatingMetrics",
140:        },
141:      },
```

## Export and reset

- Calling `orchestrator.export(id, target)` sends an EXPORT event and the machine will run the exporter handler while the editing stage switches to an exporting substate.
- Calling `orchestrator.reset()` will abort the current actor, stop the machine and reinitialize a fresh instance. `cleanPersistence()` clears persisted data if the UI needs that option.

## Observables / Signals to subscribe to from the UI

Use the OrchestratorModule's Subjects/Signals to render live UI state:

- context$ / context (signal)
- state$ / state
- metrics$ / metrics
- layout$ / layout
- file$ / file
- currentRows$ / currentRows
- currentErrors$ / currentErrors
- step$ / step (array of step markers)
- viewPaginationInfo$ / viewPaginationInfo
- viewFilter$ / viewFilter

These are available as both RxJS Observables and @preact/signals computed values in the OrchestratorModule implementation.

## UI recommendations

- Only call `editRow(...)` or `removeRow(...)` after the user explicitly confirms the intention.
- Disable navigation / editing controls unless the orchestrator's `step` includes the editing idle marker (STEПS.EDITING.IDLE).
- Show an inline edit UI with explicit Confirm/Cancel. On confirm call `editRow(...)`.
- After edits/removals complete, refresh the visible page (call `changeViewPage(currentPage)` if pagination changed) and show a brief success notification.
- Indicate whether edits will re-run global steps (if your integration allows toggling this).

## Example integration checklist

- Subscribe to `step$`, `context$`, `metrics$`, and `currentRows$` to render UI and enable/disable controls.
- Confirm with the user before calling `editRow(rowId, key, value)` or `removeRow(rowId)`.
- After actions complete, refresh the view and read `viewPaginationInfo` / `metrics` to update counts and pages.
- Use `cleanPersistence()` or `reset()` when the user wants to start over.

---

File updated to align with the current orchestrator state-machine and public API. See referenced source files for the exact handler and step names.

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
