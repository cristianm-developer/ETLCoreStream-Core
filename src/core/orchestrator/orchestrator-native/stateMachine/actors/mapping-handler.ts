import { fromCallback } from "xstate";
import { errorEventGen } from "../events/error";
import { STEPS } from "../consts/steps";
import type { IMappingModule } from "@/core/mapping/i-mapping-module";
import type { LayoutBase } from "@/shared";
import type { Signal } from "@preact/signals-core";
import type {
  FinishedStreamEvent,
  ProgressUpdatedEvent,
  StreamCreatedEvent,
} from "../events/modules-events";
import type { ErrorEvent } from "../events/error";

export type MappingHandlerInput = {
  mappingModule: IMappingModule;
  stream: ReadableStream;
  layout: LayoutBase;
  totalEstimatedRows: Signal<number | null>;
  abortSignal: AbortSignal;
};

export const mappingHandler = fromCallback<
  any,
  MappingHandlerInput,
  StreamCreatedEvent | ErrorEvent | FinishedStreamEvent | ProgressUpdatedEvent
>(({ input, sendBack, self }) => {
  let isFinished = false;
  const { abortSignal } = input;

  try {
    const mappingModule = input.mappingModule;
    const progress = mappingModule.progress;

    mappingModule
      .handleStream(input.stream, input.layout, input.totalEstimatedRows, abortSignal)
      .then(
        (stream) => {
          const instrumentedStream = stream.pipeThrough(
            new TransformStream({
              transform: (chunk, controller) => {
                abortSignal.throwIfAborted();
                controller.enqueue(chunk);
              },
              flush: () => {
                isFinished = true;
                sendBack({ type: "FINISHED_STREAM", streamType: "mappingStream" });
                sendBack({ type: "PROGRESS_UPDATED", progress: { value: null, label: "Mapping" } });
              },
            })
          );

          sendBack({ type: "STREAM_CREATED", stream: instrumentedStream });
        },
        (error) => {
          throw error;
        }
      )
      .catch((error) => {
        if (error instanceof Error) {
          const errorMessages = [
            "Cannot be mapped",
            "Headers are not valid",
            "No map found",
            "No rows to remap",
            "Mapping cancelled",
          ];
          if (errorMessages.some((message) => error.message.includes(message))) {
            sendBack(errorEventGen.expected(self, error as Error, STEPS.READING_DATA.MAPPING_DATA));
          } else {
            sendBack(
              errorEventGen.unexpected(self, error as Error, STEPS.READING_DATA.MAPPING_DATA)
            );
          }
        } else {
          sendBack(errorEventGen.unexpected(self, error as Error, STEPS.READING_DATA.MAPPING_DATA));
        }
      });

    progress.subscribe((progress) => {
      if (!isFinished) {
        sendBack({ type: "PROGRESS_UPDATED", progress: { value: progress, label: "Mapping" } });
      }
    });
  } catch (error) {
    sendBack(errorEventGen.unexpected(self, error as Error, STEPS.READING_DATA.MAPPING_DATA));
  }
});
