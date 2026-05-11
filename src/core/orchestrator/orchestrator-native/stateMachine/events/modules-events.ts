import type { Signal } from "@preact/signals-core";
import type { StreamsType } from "../actions/streams-actions";
import type { RowObject } from "@/shared";

export type ModuleEvents =
  | StreamCreatedEvent
  | ProgressUpdatedEvent
  | FinishedStreamEvent
  | EstimatedRowsUpdatedEvent
  | FirstChunkRawReadyEvent
  | FirstChunkProcessedReadyEvent
  | FinishedPersistenceEvent
  | FinishedGlobalStepsEvent
  | FinishedReadingDataEvent;

export type StreamCreatedEvent = {
  type: "STREAM_CREATED";
  stream: ReadableStream;
};

export type ProgressUpdatedEvent = {
  type: "PROGRESS_UPDATED";
  progress: { label: string; value: number | null };
};

export type EstimatedRowsUpdatedEvent = {
  type: "ESTIMATED_ROWS_UPDATED";
  totalEstimatedRows: Signal<number | null>;
};

export type FinishedStreamEvent = {
  type: "FINISHED_STREAM";
  streamType: StreamsType;
};

export type FinishedPersistenceEvent = {
  type: "FINISHED_PERSISTENCE";
};

export type FinishedGlobalStepsEvent = {
  type: "FINISHED_GLOBAL_STEPS";
};

export type FirstChunkRawReadyEvent = {
  type: "FIRST_CHUNK_RAW_READY";
};

export type FirstChunkProcessedReadyEvent = {
  type: "FIRST_CHUNK_PROCESSED_READY";
  rows: RowObject[];
};

export type FinishedReadingDataEvent = {
  type: "FINISHED_READING_DATA";
};
