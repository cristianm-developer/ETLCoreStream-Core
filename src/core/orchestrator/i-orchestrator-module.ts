import type { LayoutBase } from "@/shared/schemes/layout-base";
import type { Log } from "@/shared/schemes/log";
import type { Observable } from "rxjs";
import type { ProviderModule } from "../provider/main";
import type { Notification } from "@/shared/schemes/notification";
import type { FileMetrics, RowFilter, RowObject } from "@/shared";
import type { ReadonlySignal } from "@preact/signals-core";
import type { RecoverPoint } from "@/shared/schemes/recover-point";

/**
 * Public interface for the orchestrator module.
 *
 * The orchestrator coordinates ETL flow: it exposes reactive state,
 * publishes logs/notifications and provides imperative actions used by
 * consumers (UI, tests, other modules). Implementations should wire the
 * internal state machines and provider modules to satisfy these contracts.
 */
export interface IOrchestratorModule {
  /**
   * Initialize the orchestrator with a provider module and optional id.
   * The provider supplies other modules (logger, persistence, exporters, etc).
   * @param provider - host provider containing required modules and options
   * @param id - optional identifier to use for this orchestrator instance
   */
  initialize(provider: ProviderModule, id?: string): void;

  /* identity / state / context */
  /**
   * Return the orchestrator instance id.
   */
  getId(): string;

  /**
   * Return the current state name or representation (used by consumers to
   * inspect high level machine state).
   */
  getCurrentState(): string;

  /**
   * Return the current internal context/state snapshot (read-only). The
   * concrete shape depends on the implementation.
   */
  getCurrentContext(): any;

  /* reactive observables exposed by the module */
  /**
   * Stream of log entries emitted by the orchestrator's logger.
   */
  logs$: Observable<Log>;

  /**
   * Stream that emits user-facing notifications or null when none present.
   */
  notification$: Observable<Notification | null>;

  // handler for signals access
  /**
   * Observable that emits the currently selected layout (or null).
   */
  layout$: Observable<LayoutBase | null>;
  /**
   * Readonly signal exposing the current layout for synchronous reads.
   */
  layout: ReadonlySignal<LayoutBase | null>;

  /**
   * Observable that emits the current high-level state value.
   */
  state$: Observable<any>;
  /**
   * Readonly signal exposing the current state for synchronous reads.
   */
  state: ReadonlySignal<any>;

  /**
   * Observable that emits file metrics (progress, counts) or null.
   */
  metrics$: Observable<FileMetrics | null>;
  /**
   * Signal for synchronous access to file metrics.
   */
  metrics: ReadonlySignal<FileMetrics | null>;

  /**
   * Observable emitting an array of progress entries (label + numeric value).
   */
  progress$: Observable<{ label: string; value: number | null }[]>;
  /**
   * Signal for synchronous access to progress entries.
   */
  progress: ReadonlySignal<{ label: string; value: number | null }[]>;

  /**
   * Observable that emits the selected input `File` or null.
   */
  file$: Observable<File | null>;
  /**
   * Signal for synchronous access to the selected file.
   */
  file: ReadonlySignal<File | null>;

  /**
   * Observable that emits the orchestrator context object or null.
   */
  context$: Observable<any | null>;
  /**
   * Signal for synchronous access to the orchestrator context.
   */
  context: ReadonlySignal<any | null>;

  /**
   * Observable that emits an available recovery point (or null).
   */
  recoveryPoint$: Observable<RecoverPoint | null>;
  /**
   * Signal exposing the current recovery point synchronously.
   */
  recoveryPoint: ReadonlySignal<RecoverPoint | null>;

  /**
   * Observable that emits the current rows visible to the view (or null).
   */
  currentRows$: Observable<RowObject[] | null>;
  /**
   * Signal for synchronous access to current rows.
   */
  currentRows: ReadonlySignal<RowObject[] | null>;

  /**
   * Observable emitting pagination metadata used by the view.
   */
  viewPaginationInfo$: Observable<{ currentPage: number | null; totalPages: number | null }>;
  /**
   * Signal exposing pagination metadata for synchronous reads.
   */
  viewPaginationInfo: ReadonlySignal<{
    currentPage: number;
    totalPages: number;
  }>;

  /**
   * Observable emitting the current view filter (or null when none).
   */
  viewFilter$: Observable<RowFilter | null>;
  /**
   * Signal for synchronous access to the view filter.
   */
  viewFilter: ReadonlySignal<RowFilter | null>;

  /**
   * Observable that emits an object with unexpected/expected errors.
   */
  errors$: Observable<{
    unexpected: Error | null;
    expected: Error | null;
  }>;
  /**
   * Signal exposing current error information synchronously.
   */
  errors: ReadonlySignal<{
    unexpected: Error | null;
    expected: Error | null;
  }>;

  /**
   * Observable that emits the current step(s) the orchestrator is executing.
   */
  step$: Observable<string[]>;
  /**
   * Signal exposing the current step(s) synchronously.
   */
  step: ReadonlySignal<string[]>;

  /* helper to retrieve logs synchronously from the logger */
  /**
   * Retrieve logs synchronously from the underlying logger.
   * All parameters are optional and act as filters when provided.
   * @param fromTime - include logs after this date/time
   * @param toTime - include logs before this date/time
   * @param fromIndex - include logs starting from this index
   * @param toIndex - include logs up to this index
   * @param level - filter by log level
   * @param step - filter by step name
   * @param id - filter by origin id
   * @returns array of matching Log entries
   */
  getLogs(
    fromTime?: Date,
    toTime?: Date,
    fromIndex?: number,
    toIndex?: number,
    level?: "info" | "warn" | "error" | "debug" | "success",
    step?: string,
    id?: string
  ): Log[];

  /* lifecycle */
  /**
   * Stop the orchestrator and release resources (actors, subscriptions).
   */
  stop(): void;
  /**
   * Reset the orchestrator to its initial state (stop + re-initialize).
   */
  reset(): void;

  /* actions available to consumers */
  /**
   * Select an input file to start processing.
   * @param file - native File object selected by the user
   */
  selectFile(file: File): void;

  /**
   * Select a layout describing how input columns map to internal fields.
   * @param layout - layout configuration object
   */
  selectLayout(layout: LayoutBase): void;

  /**
   * Change the current view filter (used by UI to filter rows).
   * @param filter - RowFilter or null to clear the filter
   */
  changeViewFilter(filter: RowFilter | null): void;

  /**
   * Change the currently viewed page in the UI.
   * @param pageNumber - 1-based page number to display
   */
  changeViewPage(pageNumber: number): void;

  /**
   * Remove a row from the current dataset by its numeric id.
   * @param rowId - identifier of the row to remove
   */
  removeRow(rowId: number): void;

  /**
   * Trigger an export by id to either a stream or a file.
   * @param id - exporter id or configuration key
   * @param target - "Stream" to export to stream, "File" to write a file
   */
  export(id: string, target: "Stream" | "File"): void;

  /**
   * Edit a value in a specific row.
   * @param rowId - id of the row being edited
   * @param key - column/key to update
   * @param value - new value as string
   */
  editRow(rowId: number, key: string, value: string): void;

  /**
   * Update configuration for a named module before processing starts.
   * Implementations may restrict when this call is allowed.
   * @param module - module name to update (e.g. "parser", "persistence")
   * @param options - module specific options object
   */
  updateConfig(module: string, options: any): void;

  /**
   * Choose the recovery action when a recovery point is available.
   * @param action - "recover" to resume from recovery point or "skip" to continue
   */
  recoverActionChoosen(action: "recover" | "skip"): void;

  /* utilities */
  /**
   * Remove persisted state (persistence clear). Use with care.
   */
  cleanPersistence(): void;
}
