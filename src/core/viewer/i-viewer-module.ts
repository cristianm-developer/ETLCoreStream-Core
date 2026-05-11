import type { RowFilter } from "@/shared/schemes/persistent-filter";
import type { IPersistenceModule } from "../persistence/i-persistence-module";
import type { RowObject } from "@/shared";

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
    filter?: RowFilter,
    pageNumber?: number,
    signal?: AbortSignal
  ) => Promise<RowObject[]>;
  editRow: (
    persistenceModule: IPersistenceModule,
    payload: EditRowPayload,
    signal?: AbortSignal
  ) => Promise<void>;

  getTotalPages: (totalRows: number) => number;
  updateOptions(options: Partial<ViewerModuleOptions>): void;
}
