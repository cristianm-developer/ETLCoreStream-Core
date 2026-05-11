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

export type GlobalStepsHandlerInput = {
  globalStepsEngineModule: IGlobalStepsEngineModule;
  persistingModule: IPersistenceModule;
  layout: LayoutBase;
  totalEstimatedRows: Signal<number | null>;
};

export const globalStepsHandler = fromCallback<
  any,
  GlobalStepsHandlerInput,
  FirstChunkProcessedReadyEvent | ErrorEvent | ProgressUpdatedEvent | FinishedGlobalStepsEvent
>(({ input, emit, self }) => {
  const { globalStepsEngineModule, persistingModule, layout, totalEstimatedRows } = input;

  const progress = globalStepsEngineModule.progress;
  let isFinished = false;

  try {
    (async () => {
      for (const step of layout.globalSteps ?? []) {
        if (isFinished) return;

        const removedErrorsAcc: number[] = [];
        const filter = step.filter.rows;
        const streamInput = persistingModule.getRowsStream(filter);

        const streamResult = globalStepsEngineModule.handleStep(
          streamInput,
          step,
          totalEstimatedRows
        );

        let firstChunkProcessed: RowObject[] = [];

        const trasnformedStream = streamResult.pipeThrough(
          new TransformStream({
            transform: async ({ rows, errors, removedErrors }: any, controller) => {
              removedErrorsAcc.push(...(removedErrors ?? []));
              if (!firstChunkProcessed) {
                firstChunkProcessed = rows;
                emit({ type: "FIRST_CHUNK_PROCESSED_READY", rows: firstChunkProcessed });
              }
              controller.enqueue({ rows, errorDicc: errors });
            },
          })
        );

        await persistingModule.saveStream(trasnformedStream, null, null);

        if (removedErrorsAcc.length > 0) {
          await persistingModule.deleteErrors(removedErrorsAcc);
        }
      }
    })()
      .catch((error) => {
        emit(
          errorEventGen.unexpected(self, error as Error, STEPS.READING_DATA.HANDLING_GLOBAL_STEPS)
        );
      })
      .then(() => {
        isFinished = true;
        emit({ type: "PROGRESS_UPDATED", progress: { value: null, label: "Global Steps" } });
        emit({ type: "FINISHED_GLOBAL_STEPS" });
      });

    progress.subscribe((progress) => {
      if (!isFinished) {
        emit({ type: "PROGRESS_UPDATED", progress: { value: progress, label: "Global Steps" } });
      }
    });
  } catch (error) {
    emit(errorEventGen.unexpected(self, error as Error, STEPS.READING_DATA.HANDLING_GLOBAL_STEPS));
  }
});
