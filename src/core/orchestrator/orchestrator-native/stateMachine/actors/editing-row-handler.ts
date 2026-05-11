import type { IPersistenceModule } from "@/core/persistence/i-persistence-module";
import type { IGlobalStepsEngineModule } from "@/core/steps-engine/i-global-steps-engine-module";
import type { ILocalStepsEngineModule } from "@/core/steps-engine/i-local-steps-engine-module";
import type { IViewerModule } from "@/core/viewer/i-viewer-module";
import type { LayoutBase } from "@/shared";
import { signal } from "@preact/signals-core";
import { fromPromise } from "xstate";

export type EditingRowHandlerInput = {
  rowId: number;
  key: string;
  value: string;
  persistenceModule: IPersistenceModule;
  viewerModule: IViewerModule;
};

export const editingRowHandler = fromPromise<void, EditingRowHandlerInput>(async ({ input }) => {
  const { rowId, key, value, viewerModule, persistenceModule } = input;

  await viewerModule.editRow(persistenceModule, {
    rowId,
    headerKeyEdited: key,
    newValue: value,
  });
});

export type LocalStepPipeHandlerInput = {
  rowId: number;
  localStepEngineModule: ILocalStepsEngineModule;
  persistenceModule: IPersistenceModule;
  layout: LayoutBase;
};

export const localStepPipeHandler = fromPromise<void, LocalStepPipeHandlerInput>(
  async ({ input }) => {
    const { rowId, localStepEngineModule, persistenceModule, layout } = input;

    const stream = persistenceModule.getRowsStream({ rowIdIn: [rowId] });
    const resultStream = await localStepEngineModule.handleStream(stream, layout, signal(1));

    await persistenceModule.saveStream(resultStream, signal(1));
  }
);

export type GlobalStepPipeHandlerInput = {
  rowId: number;
  globalStepEngineModule: IGlobalStepsEngineModule;
  persistenceModule: IPersistenceModule;
  layout: LayoutBase;
};

export const globalStepPipeHandler = fromPromise<void, GlobalStepPipeHandlerInput>(
  async ({ input }) => {
    const { rowId, globalStepEngineModule, persistenceModule, layout } = input;

    for (const step of layout.globalSteps) {
      const removedErrorsAcc: number[] = [];
      const rowIds: number[] | undefined = step.reprocessAllRowsOnChange ? undefined : [rowId];

      const stream = persistenceModule.getRowsStream({ ...step.filter.rows, rowIdIn: rowIds });
      const resultStream = await globalStepEngineModule.handleStep(stream, step, signal(null));
      const parsedStream = resultStream.pipeThrough(
        new TransformStream({
          transform: async ({ rows, errors, removedErrors }: any, controller) => {
            removedErrorsAcc.push(...(removedErrors ?? []));
            controller.enqueue({ rows, errorDicc: errors });
          },
        })
      );

      await persistenceModule.saveStream(parsedStream, signal(null));

      if (removedErrorsAcc.length > 0) {
        await persistenceModule.deleteErrors(removedErrorsAcc);
      }
    }
  }
);
