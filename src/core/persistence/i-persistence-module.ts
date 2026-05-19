import type { ValidationError } from "@/shared/schemes/local-step-validators";
import type { RowFilter } from "@/shared/schemes/persistent-filter";
import type { RowObject } from "@/shared/schemes/row-object";
import type { FileMetrics } from "@/shared/schemes/file-metrics";
import type { Signal } from "@preact/signals-core";
import type {
  GetRowsPaginatedOptions,
  GetRowsPaginatedResult,
} from "@/shared/schemes/view-pagination";
import type { RecoverPoint } from "@/shared/schemes/recover-point";

export type PersistenceModuleOptions = {
  chunkSizeQtd?: number;
  dbName: string;
  storeNames: {
    rows: string;
    errors: string;
    metrics: string;
    recoveryPoint: string;
  };
  storeKeys: {
    rows: string;
    errors: string;
    metrics: string;
    recoveryPoint: string;
  };
};

export const DEFAULT_PERSISTENCE_MODULE_OPTIONS: PersistenceModuleOptions = {
  chunkSizeQtd: 100,
  dbName: "importer-db",
  storeNames: {
    rows: "rows",
    errors: "errors",
    metrics: "metrics",
    recoveryPoint: "recoveryPoint",
  },
  storeKeys: {
    rows: "__rowId",
    errors: "__rowId",
    metrics: "fileName",
    recoveryPoint: "fileName",
  },
};

export interface IPersistenceModule {
  id: "persistence-indexdb";

  progress: Signal<number | null>;

  saveStream: (
    stream: ReadableStream<{ rows: RowObject[]; errorDicc: Record<number, ValidationError> }>,
    totalRowEstimated: Signal<number | null> | null,
    onFirstChunkReady?: (() => void) | null,
    signal?: AbortSignal | null
  ) => Promise<void>;
  getRowsPaginated: (options: GetRowsPaginatedOptions) => Promise<GetRowsPaginatedResult>;
  getRowsStream: (
    filter: RowFilter,
    abortSignal?: AbortSignal,
    batchSize?: number
  ) => ReadableStream<{ rows: RowObject[] }>;
  getErrorsStream: (filter: RowFilter) => ReadableStream<{ errors: ValidationError[] }>;
  clear: () => Promise<void>;

  getRowById: (id: number) => Promise<RowObject | undefined>;
  getErrorById: (id: number) => Promise<ValidationError | undefined>;

  updateRow: (row: RowObject) => Promise<void>;
  deleteRow: (id: number) => Promise<void>;
  deleteErrors: (ids: number[]) => Promise<void>;

  getRecoveryPoint: () => Promise<RecoverPoint | undefined | null>;
  updateRecoveryPoint: (recoveryPoint: RecoverPoint) => Promise<void>;

  updateMetrics: (fileName: string, filter?: RowFilter) => Promise<void>;
  getMetrics: (fileName: string) => Promise<FileMetrics | undefined>;
  updateOptions(options: Partial<PersistenceModuleOptions>): void;
}
