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
  abortSignal: AbortSignal;
};

export const localStepsHandler = fromCallback<
  any,
  LocalStepsHandlerInput,
  StreamCreatedEvent | ErrorEvent | ProgressUpdatedEvent | FinishedStreamEvent
>(({ input, sendBack, self }) => {
  try {
    const { abortSignal, localStepEngine, stream, layout, totalEstimatedRows } = input;
    const progress = localStepEngine.progress;

    const handledStream = localStepEngine.handleStream(
      stream,
      layout,
      totalEstimatedRows,
      abortSignal
    );
    const instrumentedStream = handledStream.pipeThrough(
      new TransformStream({
        transform: (chunk, controller) => {
          try {
            abortSignal.throwIfAborted();
            controller.enqueue(chunk);
          } catch (error) {
            const isExpected =
              error instanceof Error && error.message === "Max error count reached";

            sendBack(
              isExpected
                ? errorEventGen.expected(
                    self,
                    error as Error,
                    STEPS.READING_DATA.HANDLING_LOCAL_STEPS
                  )
                : errorEventGen.unexpected(
                    self,
                    error as Error,
                    STEPS.READING_DATA.HANDLING_LOCAL_STEPS
                  )
            );
          }
        },
        flush: () => {
          sendBack({ type: "FINISHED_STREAM", streamType: "localStepsStream" });
          sendBack({
            type: "PROGRESS_UPDATED",
            progress: { value: null, label: "Handling Local Steps" },
          });
        },
      })
    );

    progress.subscribe((value) => {
      sendBack({ type: "PROGRESS_UPDATED", progress: { value, label: "Handling Local Steps" } });
    });

    sendBack({ type: "STREAM_CREATED", stream: instrumentedStream });
  } catch (error) {
    sendBack(
      errorEventGen.unexpected(self, error as Error, STEPS.READING_DATA.HANDLING_LOCAL_STEPS)
    );
  }
});
