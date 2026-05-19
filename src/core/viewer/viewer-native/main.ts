import type { LoggerModule } from "@/core/logger/logger-native/main";
import type { IPersistenceModule } from "@/core/persistence/i-persistence-module";
import type { IViewerModule, EditRowPayload, ViewerModuleOptions } from "../i-viewer-module";
import type { RowFilter } from "@/shared/schemes/persistent-filter";
import { isEqual } from "lodash-es";

interface ViewState {
  lastPageLoaded: number | null;
  nextCursor: number | null;
  prevCursor: number | null;
  lastFilterLoaded: RowFilter | null;
}

export class ViewerModule implements IViewerModule {
  id: string = "viewer-native";

  private logger: LoggerModule;
  private options: ViewerModuleOptions;

  private viewState: ViewState = {
    lastPageLoaded: null,
    nextCursor: null,
    prevCursor: null,
    lastFilterLoaded: null,
  };

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

      this.viewState.lastFilterLoaded ??= {};

      pageNumber = pageNumber ?? 1;

      signal?.throwIfAborted();

      let cursor: number | null = null;
      let direction: "next" | "prev" = "next";

      if (!isEqual(filter, this.viewState.lastFilterLoaded)) {
        if (pageNumber != 1) {
          throw new Error("Page Number must be 1 when a new filter is defined");
        }
      } else {
        if (pageNumber > (this.viewState.lastPageLoaded ?? 0)) {
          cursor = this.viewState.nextCursor;
          direction = "next";
        } else if (pageNumber < (this.viewState.lastPageLoaded ?? 0)) {
          cursor = this.viewState.prevCursor;
          direction = "prev";
        }
      }

      const result = await persistenceModule.getRowsPaginated({
        filter,
        limit: this.options.defaultPageSize,
        cursor,
        direction,
      });

      signal?.throwIfAborted();

      this.viewState = {
        nextCursor: result.nextCursor,
        prevCursor: result.prevCursor,
        lastFilterLoaded: filter ?? {},
        lastPageLoaded: pageNumber,
      };

      return result.rows;
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
