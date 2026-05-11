import type { LoggerModule } from "@/core/logger/logger-native/main";
import type { IPersistenceModule } from "@/core/persistence/i-persistence-module";
import type { IViewerModule, EditRowPayload, ViewerModuleOptions } from "../i-viewer-module";
import type { RowFilter } from "@/shared/schemes/persistent-filter";
import type { RowObject } from "@/shared/schemes/row-object";

export class ViewerModule implements IViewerModule {
  id: string = "viewer-native";

  private logger: LoggerModule;
  private options: ViewerModuleOptions;

  constructor(logger: LoggerModule, options: ViewerModuleOptions) {
    this.logger = logger;
    this.options = options;
    this.logger.log("ViewerModule initialized", "debug", "constructor", this.id);
  }

  getTotalPages = (totalRows: number) => {
    return Math.ceil(totalRows / this.options.defaultPageSize) ?? 1;
  };

  getRowsWithPagination = async (
    persistenceModule: IPersistenceModule,
    filter?: RowFilter,
    pageNumber?: number,
    signal?: AbortSignal
  ) => {
    try {
      this.logger.log(
        `Fetching rows with pagination - page: ${pageNumber}, pageSize: ${this.options.defaultPageSize}`,
        "debug",
        "getRowsWithPagination",
        this.id
      );

      const innerFilter: RowFilter = {
        fromRowId: 1,
        toRowId: this.options.defaultPageSize,
        ...filter,
      };
      pageNumber = pageNumber ?? 1;

      signal?.throwIfAborted();

      if (pageNumber > 1) {
        innerFilter.fromRowId = (pageNumber - 1) * this.options.defaultPageSize + 1;
        innerFilter.toRowId = pageNumber * this.options.defaultPageSize;
      }

      const rowsStream = persistenceModule.getRowsStream(innerFilter);
      const reader = rowsStream.getReader();

      const rows: RowObject[] = [];

      try {
        while (true) {
          signal?.throwIfAborted();
          const { done, value } = await reader.read();
          if (done) break;
          rows.push(...value.rows);
        }
      } finally {
        reader.releaseLock();
      }

      return rows;
    } catch (error) {
      this.logger.log(
        `Error fetching rows with pagination: ${(error as Error).message}`,
        "error",
        "getRowsWithPagination",
        this.id
      );
      throw error;
    }
  };

  editRow = async (
    persistenceModule: IPersistenceModule,
    payload: EditRowPayload,
    signal?: AbortSignal
  ): Promise<void> => {
    try {
      const { rowId, headerKeyEdited, newValue } = payload;
      this.logger.log(
        `Editing row ${rowId}, field: ${headerKeyEdited}`,
        "debug",
        "editRow",
        this.id
      );

      signal?.throwIfAborted();

      const row = await persistenceModule.getRowById(rowId);
      if (!row) {
        throw new Error(`Row ${rowId} not found`);
      }

      signal?.throwIfAborted();

      row.value[headerKeyEdited] = newValue;
      row.__isError = null;

      await persistenceModule.updateRow(row);
      this.logger.log(`Row ${rowId} updated in persistence`, "debug", "editRow", this.id);
    } catch (error) {
      this.logger.log(
        `Error editing row: ${(error as Error).message}`,
        "error",
        "editRow",
        this.id
      );
      throw error;
    }
  };

  updateOptions(options: Partial<ViewerModuleOptions>): void {
    this.options = { ...this.options, ...options };
  }
}
