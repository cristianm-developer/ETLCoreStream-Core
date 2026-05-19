import type { IPersistenceModule } from "@/core/persistence/i-persistence-module";
import type { RowFilter, RowObject } from "@/shared";
import { fromPromise } from "xstate";
import type { IViewerModule } from "@/core/viewer/i-viewer-module";

export type RowsReaderInput = {
  persistenceModule: IPersistenceModule;
  viewerModule: IViewerModule;
  filter: RowFilter;
  pageNumber: number;
  abortSignal: AbortSignal;
};

export const rowsReader = fromPromise<RowObject[], RowsReaderInput>(
  async ({ input }): Promise<RowObject[]> => {
    const { abortSignal, persistenceModule, viewerModule, filter, pageNumber } = input;
    return await viewerModule.getRowsWithPagination(
      persistenceModule,
      filter,
      pageNumber,
      abortSignal
    );
  }
);
