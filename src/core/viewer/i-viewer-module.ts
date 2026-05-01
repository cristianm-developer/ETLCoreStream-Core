import type { RowFilter } from "@/shared/schemes/persistent-filter";
import type { RowObject } from "@/shared/schemes/row-object";
import type { FileMetrics } from "@/shared/schemes/file-metrics";
import type { IPersistenceModule } from "../persistence/i-persistence-module";

export type PaginatedRows = {
  rows: RowObject[];
  errors: any[];
  totalRows: number;
  pageSize: number;
  currentPage: number;
  totalPages: number;
};

export type EditRowPayload = {
  rowId: number;
  headerKeyEdited: string;
  newValue: any;
};

export type ViewerModuleOptions = {
  defaultFilter: RowFilter;
  defaultPageSize: number;
};

export const DEFAULT_VIEWER_MODULE_OPTIONS: ViewerModuleOptions = {
  defaultFilter: {
    withErrors: true,
    withoutErrors: true,
  },
  defaultPageSize: 50,
};

export interface IViewerModule {
  getRowsWithPagination: (
    persistenceModule: IPersistenceModule,
    metrics: FileMetrics,
    filter?: RowFilter,
    pageNumber?: number,
    signal?: AbortSignal
  ) => Promise<PaginatedRows>;
  editRow: (
    persistenceModule: IPersistenceModule,
    payload: EditRowPayload,
    signal?: AbortSignal
  ) => Promise<void>;
  removeRow: (
    persistenceModule: IPersistenceModule,
    rowId: number,
    signal?: AbortSignal
  ) => Promise<void>;
  getTotalPages: (totalRows: number) => number;
  updateOptions(options: Partial<ViewerModuleOptions>): void;
}
