import type { IGlobalStepsEngineModule } from "@/core/steps-engine/i-global-steps-engine-module";
import type { LayoutBase, RowObject } from "@/shared";
import type { Signal } from "@preact/signals-core";
import { fromCallback } from "xstate";
import type {
  FinishedGlobalStepsEvent,
  FirstChunkProcessedReadyEvent,
  ProgressUpdatedEvent,
} from "../events/modules-events";
import type { ErrorEvent } from "../events/error";
import { errorEventGen } from "../events/error";
import { STEPS } from "../consts/steps";
import type { IPersistenceModule } from "@/core/persistence/i-persistence-module";
import type { IViewerModule } from "@/core/viewer";

export type GlobalStepsHandlerInput = {
  globalStepsEngineModule: IGlobalStepsEngineModule;
  persistingModule: IPersistenceModule;
  viewModule: IViewerModule;
  layout: LayoutBase;
  totalEstimatedRows: Signal<number | null>;
  viewPageSize: number;
  abortSignal: AbortSignal;
};

export const globalStepsHandler = fromCallback<
  any,
  GlobalStepsHandlerInput,
  FirstChunkProcessedReadyEvent | ErrorEvent | ProgressUpdatedEvent | FinishedGlobalStepsEvent
>(({ input, sendBack, self }) => {
  const {
    abortSignal,
    globalStepsEngineModule,
    persistingModule,
    layout,
    totalEstimatedRows,
    viewModule,
    viewPageSize,
  } = input;

  const progress = globalStepsEngineModule.progress;
  let isFinished = false;
  let firstChunkProcessed: RowObject[] | null = null;

  const sendBackFirstChunkProcessedReady = (rows: RowObject[]) => {
    if (!firstChunkProcessed) {
      firstChunkProcessed = rows;
      const slicedRows = firstChunkProcessed.slice(0, viewPageSize);
      sendBack({ type: "FIRST_CHUNK_PROCESSED_READY", rows: slicedRows });
    }
  };

  try {
    (async () => {
      if (layout.globalSteps?.length === 0) {
        const rowsResult = await viewModule.getRowsWithPagination(
          persistingModule,
          null,
          1,
          abortSignal
        );
        sendBackFirstChunkProcessedReady(rowsResult);
      } else {
        for (const step of layout.globalSteps ?? []) {
          if (isFinished) return;

          const removedErrorsAcc: number[] = [];
          const filter = step.filter.rows;
          const streamInput = persistingModule.getRowsStream(filter);

          const streamResult = globalStepsEngineModule.handleStep(
            streamInput,
            step,
            totalEstimatedRows,
            abortSignal
          );

          const trasnformedStream = streamResult.pipeThrough(
            new TransformStream({
              transform: ({ rows, errors, removedErrors }: any, controller) => {
                removedErrorsAcc.push(...(removedErrors ?? []));
                sendBackFirstChunkProcessedReady(rows);
                controller.enqueue({ rows, errorDicc: errors });
              },
            })
          );

          await persistingModule.saveStream(trasnformedStream, null, null);

          if (removedErrorsAcc.length > 0) {
            await persistingModule.deleteErrors(removedErrorsAcc);
          }
        }
      }
    })()
      .catch((error) => {
        sendBack(
          errorEventGen.unexpected(self, error as Error, STEPS.READING_DATA.HANDLING_GLOBAL_STEPS)
        );
      })
      .then(() => {
        isFinished = true;
        sendBack({ type: "PROGRESS_UPDATED", progress: { value: null, label: "Global Steps" } });
        sendBack({ type: "FINISHED_GLOBAL_STEPS" });
      });

    progress.subscribe((progress) => {
      if (!isFinished) {
        sendBack({
          type: "PROGRESS_UPDATED",
          progress: { value: progress, label: "Global Steps" },
        });
      }
    });
  } catch (error) {
    sendBack(
      errorEventGen.unexpected(self, error as Error, STEPS.READING_DATA.HANDLING_GLOBAL_STEPS)
    );
  }
});
