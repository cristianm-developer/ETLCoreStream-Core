import type { ILoggerModule } from "@/core/logger/i-logger-module";
import type { ProviderModule } from "@/core/provider/main";
import type { FileMetrics, LayoutBase, RowObject } from "@/shared";
import type { RecoverPoint } from "@/shared/schemes/recover-point";
import type { ViewPaginationInfo } from "@/shared/schemes/view-pagination";
import type { Signal } from "@preact/signals-core";

/** Runtime context shared by the orchestrator state machine.
 *
 * Contains inputs, running state, and small caches used during orchestration.
 */
export interface OrchestratorContext {
  /** Logger module used for structured logging; null if not provided. */
  logger: ILoggerModule | null;

  /** Provider modules loaded into the orchestrator; null when not initialized. */
  modules: ProviderModule["modules"] | null;
  /** Provider configuration/options; null when not initialized. */
  settings: ProviderModule["options"] | null;

  /** The current layout definition being processed; null when none. */
  layout: LayoutBase | null;
  /** File-related metrics (e.g., row counts); null when unavailable. */
  metrics: FileMetrics | null;

  /** The file handle (Browser/File API) being processed; null when none. */
  file: File | null;

  /** Container for top-level errors encountered during orchestration.
   * - `unexpected` for unexpected runtime errors
   * - `expected` for validation or known errors
   */
  errors: {
    unexpected: Error | null;
    expected: Error | null;
  };

  /** Active streaming sources used during import and processing. */
  streams: {
    /** Stream that provides raw import data; null when closed or not set. */
    importStream: ReadableStream | null;
    /** Stream that provides mapped rows after mapping stage; null when closed. */
    mappingStream: ReadableStream | null;
    /** Stream that runs local step processors; null when closed. */
    localStepsStream: ReadableStream | null;
  };

  /** Progress entries shown to the user (label + optional numeric value), or null. */
  progress: { label: string; value: number | null }[] | null;
  /** Reactive signal representing the estimated total rows; may be null. */
  totalEstimatedRows: Signal<number | null> | null;

  /** Flag indicating whether initial persistence setup finished; null when unknown. */
  initialPersistenceDone: boolean | null;
  /** Flag indicating whether initial global steps finished; null when unknown. */
  initialGlobalStepsDone: boolean | null;

  /** Flag indicating whether the initial processing pass finished; null when unknown. */
  initialProcessingDone: boolean | null;
  /** True while rows are actively being processed; null when unknown. */
  processingRows: boolean | null;

  /** Mapping column pairs as tuples [sourceColumn, targetColumn]; null when absent. */
  mappingColumnMapEntries: [string, string][] | null;

  /** Currently loaded rows in memory for viewing/editing; null when none. */
  currentRows: RowObject[] | null;

  /** Pagination and view info used by the viewer UI. */
  viewPaginationInfo: ViewPaginationInfo;

  /** Payload describing an edit operation in the UI, or null when not editing. */
  editPayload: {
    /** Numeric identifier of the row being edited. */
    rowId: number;
    /** Column key being edited. */
    key: string;
    /** New string value for the field. */
    value: string;
  } | null;

  /** Execution step stack/path represented as an array of step ids/names. */
  step: string[];
  /** Controller used to abort ongoing async work (streams, fetches, etc.). */
  abortController: AbortController;

  /** Whether the orchestrator should check for an existing recover point. */
  checkRecoverPoint: boolean;
  /** User intent to recover to a saved point; null when undecided. */
  wantToRecoverPoint: boolean | null;
  /** Current recover point data if available; null otherwise. */
  recoveryPoint: RecoverPoint | null;
}

export const EMPTY_CONTEXT: OrchestratorContext = {
  currentRows: null,
  editPayload: null,
  errors: {
    unexpected: null,
    expected: null,
  },
  file: null,
  metrics: null,
  layout: null,
  streams: {
    importStream: null,
    mappingStream: null,
    localStepsStream: null,
  },
  progress: [],
  totalEstimatedRows: null,
  initialProcessingDone: false,
  processingRows: false,
  mappingColumnMapEntries: null,
  viewPaginationInfo: {
    currentPage: 1,
    totalPages: 1,
    currentFilter: {},
  },
  logger: null,
  modules: null,
  settings: null,
  step: [],
  abortController: new AbortController(),
  initialGlobalStepsDone: false,
  initialPersistenceDone: false,

  checkRecoverPoint: false,
  wantToRecoverPoint: null,
  recoveryPoint: null,
};
