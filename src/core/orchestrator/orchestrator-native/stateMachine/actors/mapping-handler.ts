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
};

export const mappingHandler = fromCallback<
  any,
  MappingHandlerInput,
  StreamCreatedEvent | ErrorEvent | FinishedStreamEvent | ProgressUpdatedEvent
>(({ input, emit, self }) => {
  let isFinished = false;

  try {
    const mappingModule = input.mappingModule;
    const progress = mappingModule.progress;

    mappingModule.handleStream(input.stream, input.layout, input.totalEstimatedRows).then(
      (stream) => {
        const instrumentedStream = stream.pipeThrough(
          new TransformStream({
            transform: (chunk, controller) => {
              try {
                controller.enqueue(chunk);
              } catch (error) {
                emit(
                  errorEventGen.unexpected(self, error as Error, STEPS.READING_DATA.MAPPING_DATA)
                );
              }
            },
            flush: () => {
              isFinished = true;
              emit({ type: "FINISHED_STREAM", streamType: "mappingStream" });
              emit({ type: "PROGRESS_UPDATED", progress: { value: null, label: "Mapping" } });
            },
          })
        );

        emit({ type: "STREAM_CREATED", stream: instrumentedStream });
      },
      (error) => {
        if (error instanceof Error) {
          const errorMessages = [
            "Cannot be mapped",
            "Headers are not valid",
            "No map found",
            "No rows to remap",
          ];
          if (errorMessages.some((message) => error.message.includes(message))) {
            emit(errorEventGen.expected(self, error as Error, STEPS.READING_DATA.MAPPING_DATA));
          }
        } else {
          emit(errorEventGen.unexpected(self, error as Error, STEPS.READING_DATA.MAPPING_DATA));
        }
      }
    );

    progress.subscribe((progress) => {
      if (!isFinished) {
        emit({ type: "PROGRESS_UPDATED", progress: { value: progress, label: "Mapping" } });
      }
    });
  } catch (error) {
    emit(errorEventGen.unexpected(self, error as Error, STEPS.READING_DATA.MAPPING_DATA));
  }
});
