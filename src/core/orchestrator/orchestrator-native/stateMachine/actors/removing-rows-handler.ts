import type { IPersistenceModule } from "@/core/persistence/i-persistence-module";
import { fromPromise } from "xstate";

export type RemovingRowsHandlerInput = {
  rowId: number;
  persistenceModule: IPersistenceModule;
};

export const removingRowsHandler = fromPromise<void, RemovingRowsHandlerInput>(
  async ({ input }) => {
    const { rowId, persistenceModule } = input;
    await persistenceModule.deleteRow(rowId);
  }
);
