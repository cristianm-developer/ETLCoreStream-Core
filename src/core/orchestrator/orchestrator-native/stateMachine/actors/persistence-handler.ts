import type { IPersistenceModule } from "@/core/persistence/i-persistence-module";
import type { Signal } from "@preact/signals-core";
import { fromCallback } from "xstate";
import type {
  FinishedPersistenceEvent,
  FirstChunkRawReadyEvent,
  ProgressUpdatedEvent,
} from "../events/modules-events";
import type { ErrorEvent } from "../events/error";
import { errorEventGen } from "../events/error";
import { STEPS } from "../consts/steps";

export interface PersistenceHandlerInput {
  persistenceModule: IPersistenceModule;
  stream: ReadableStream;
  totalEstimatedRows: Signal<number | null>;
}

export const persistenceHandler = fromCallback<
  any,
  PersistenceHandlerInput,
  FirstChunkRawReadyEvent | ErrorEvent | ProgressUpdatedEvent | FinishedPersistenceEvent
>(({ input, emit, self }) => {
  const { persistenceModule, stream, totalEstimatedRows } = input;

  const progress = persistenceModule.progress;
  let isFinished = false;

  try {
    persistenceModule
      .saveStream(stream, totalEstimatedRows, () => emit({ type: "FIRST_CHUNK_RAW_READY" }))
      .then(() => {
        isFinished = true;
        emit({ type: "PROGRESS_UPDATED", progress: { value: null, label: "Persisting data" } });
        emit({ type: "FINISHED_PERSISTENCE" });
      })
      .catch((error) => {
        emit(errorEventGen.unexpected(self, error as Error, STEPS.READING_DATA.PERSISTING_DATA));
      });

    progress.subscribe((progress) => {
      if (!isFinished) {
        emit({ type: "PROGRESS_UPDATED", progress: { value: progress, label: "Persisting data" } });
      }
    });
  } catch (error) {
    emit(errorEventGen.unexpected(self, error as Error, STEPS.READING_DATA.PERSISTING_DATA));
  }
});
