import { assign } from "xstate";
import { mainStateMachineSetup } from "../state-machine-root";

export type StreamsType =
  | "importStream"
  | "mappingStream"
  | "localStepsStream"
  | "persistingStream";

export type StreamsActions =
  | "setImporterStream"
  | "setMappingStream"
  | "setLocalStepsStream"
  | "setPersistingStream";

export const clearStream = mainStateMachineSetup.createAction(
  assign({
    streams: ({ context, event }) => {
      if (event.type !== "FINISHED_STREAM") return context.streams;

      return { ...context.streams, [event.streamType]: null };
    },
  })
);

export const setImporterStream = mainStateMachineSetup.createAction(
  assign({
    streams: ({ context, event }) => {
      if (event.type !== "STREAM_CREATED") return context.streams;

      return { ...context.streams, importStream: event.stream };
    },
  })
);

export const setMappingStream = mainStateMachineSetup.createAction(
  assign({
    streams: ({ context, event }) => {
      if (event.type !== "STREAM_CREATED") return context.streams;

      return { ...context.streams, mappingStream: event.stream };
    },
  })
);

export const setLocalStepsStream = mainStateMachineSetup.createAction(
  assign({
    streams: ({ context, event }) => {
      if (event.type !== "STREAM_CREATED") return context.streams;

      return { ...context.streams, localStepsStream: event.stream };
    },
  })
);

export const setPersistingStream = mainStateMachineSetup.createAction(
  assign({
    streams: ({ context, event }) => {
      if (event.type !== "STREAM_CREATED") return context.streams;

      return { ...context.streams, persistingStream: event.stream };
    },
  })
);

export const streamsActions = {
  setImporterStream,
  setMappingStream,
  setLocalStepsStream,
  setPersistingStream,
} as Record<StreamsActions, any>;
