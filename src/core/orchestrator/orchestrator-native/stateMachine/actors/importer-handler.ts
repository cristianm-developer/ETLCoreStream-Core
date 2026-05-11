import type { IImportFileModule } from "@/core/import-file/i-import-file-module";
import { fromCallback } from "xstate";
import type {
  EstimatedRowsUpdatedEvent,
  FinishedStreamEvent,
  ProgressUpdatedEvent,
  StreamCreatedEvent,
} from "../events/modules-events";
import type { ErrorEvent } from "../events/error";
import { errorEventGen } from "../events/error";
import { STEPS } from "../consts/steps";

export type ImporterHandlerInput = {
  importerModule: IImportFileModule;
  file: File;
};

export const importerHandler = fromCallback<
  any,
  ImporterHandlerInput,
  | EstimatedRowsUpdatedEvent
  | StreamCreatedEvent
  | ProgressUpdatedEvent
  | FinishedStreamEvent
  | ErrorEvent
>(({ input, emit, self }) => {
  const { importerModule, file } = input;

  let isFinished = false;

  try {
    const progress = importerModule.progress;
    const stream = importerModule.readFileStream(file);
    const totalEstimatedRows = importerModule.totalEstimatedRows;

    const instrumentedStream = stream.pipeThrough(
      new TransformStream({
        transform: (chunk, controller) => {
          controller.enqueue(chunk);
        },
        flush: () => {
          isFinished = true;
          emit({
            type: "FINISHED_STREAM",
            streamType: "importStream",
          });
          emit({
            type: "PROGRESS_UPDATED",
            progress: { value: null, label: "Importing data" },
          });
        },
      })
    );

    emit({ type: "STREAM_CREATED", stream: instrumentedStream });

    progress.subscribe((progress) => {
      if (!isFinished) {
        emit({ type: "PROGRESS_UPDATED", progress: { value: progress, label: "Importing data" } });
      }
    });

    emit({ type: "ESTIMATED_ROWS_UPDATED", totalEstimatedRows: totalEstimatedRows });
  } catch (error) {
    emit(errorEventGen.unexpected(self, error as Error, STEPS.READING_DATA.IMPORTING_DATA));
  }
});
