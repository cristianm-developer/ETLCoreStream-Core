import type { ILocalStepsEngineModule } from "@/core/steps-engine/i-local-steps-engine-module";
import type { LayoutBase } from "@/shared";
import type { Signal } from "@preact/signals-core";
import { fromCallback } from "xstate";
import type {
  FinishedStreamEvent,
  ProgressUpdatedEvent,
  StreamCreatedEvent,
} from "../events/modules-events";
import type { ErrorEvent } from "../events/error";
import { errorEventGen } from "../events/error";
import { STEPS } from "../consts/steps";

export type LocalStepsHandlerInput = {
  localStepEngine: ILocalStepsEngineModule;
  stream: ReadableStream;
  layout: LayoutBase;
  totalEstimatedRows: Signal<number | null>;
};

export const localStepsHandler = fromCallback<
  any,
  LocalStepsHandlerInput,
  StreamCreatedEvent | ErrorEvent | ProgressUpdatedEvent | FinishedStreamEvent
>(({ input, emit, self }) => {
  try {
    const { localStepEngine, stream, layout, totalEstimatedRows } = input;
    const progress = localStepEngine.progress;

    const handledStream = localStepEngine.handleStream(stream, layout, totalEstimatedRows);
    const instrumentedStream = handledStream.pipeThrough(
      new TransformStream({
        transform: (chunk, controller) => {
          try {
            controller.enqueue(chunk);
          } catch (error) {
            emit(
              errorEventGen.unexpected(
                self,
                error as Error,
                STEPS.READING_DATA.HANDLING_LOCAL_STEPS
              )
            );
          }
        },
        flush: () => {
          emit({ type: "FINISHED_STREAM", streamType: "localStepsStream" });
          emit({
            type: "PROGRESS_UPDATED",
            progress: { value: null, label: "Handling Local Steps" },
          });
        },
      })
    );

    progress.subscribe((value) => {
      emit({ type: "PROGRESS_UPDATED", progress: { value, label: "Handling Local Steps" } });
    });

    emit({ type: "STREAM_CREATED", stream: instrumentedStream });
  } catch (error) {
    emit(errorEventGen.unexpected(self, error as Error, STEPS.READING_DATA.HANDLING_LOCAL_STEPS));
  }
});
