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
  abortSignal: AbortSignal;
};

export const importerHandler = fromCallback<
  any,
  ImporterHandlerInput,
  | EstimatedRowsUpdatedEvent
  | StreamCreatedEvent
  | ProgressUpdatedEvent
  | FinishedStreamEvent
  | ErrorEvent
>(({ input, sendBack, self }) => {
  const { importerModule, file, abortSignal } = input;

  let isFinished = false;

  try {
    const progress = importerModule.progress;
    const stream = importerModule.readFileStream(file, abortSignal);
    const totalEstimatedRows = importerModule.totalEstimatedRows;

    const instrumentedStream = stream.pipeThrough(
      new TransformStream({
        transform: (chunk, controller) => {
          abortSignal.throwIfAborted();
          controller.enqueue(chunk);
        },
        flush: () => {
          isFinished = true;
          sendBack({
            type: "FINISHED_STREAM",
            streamType: "importStream",
          });
          sendBack({
            type: "PROGRESS_UPDATED",
            progress: { value: null, label: "Importing data" },
          });
        },
      })
    );

    sendBack({ type: "STREAM_CREATED", stream: instrumentedStream });

    progress.subscribe((progress) => {
      if (!isFinished) {
        sendBack({
          type: "PROGRESS_UPDATED",
          progress: { value: progress, label: "Importing data" },
        });
      }
    });

    sendBack({ type: "ESTIMATED_ROWS_UPDATED", totalEstimatedRows: totalEstimatedRows });
  } catch (error) {
    sendBack(errorEventGen.unexpected(self, error as Error, STEPS.READING_DATA.IMPORTING_DATA));
  }
});
