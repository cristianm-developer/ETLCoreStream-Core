import { assign } from "xstate";

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

export const clearStream = assign({
  streams: ({ context, event }) => {
    if (event.type !== "FINISHED_STREAM") return context.streams;

    return { ...context.streams, [event.streamType]: null };
  },
});

export const setImporterStream = assign({
  streams: ({ context, event }) => {
    if (event.type !== "STREAM_CREATED") return context.streams;

    return { ...context.streams, importStream: event.stream };
  },
});

export const setMappingStream = assign({
  streams: ({ context, event }) => {
    if (event.type !== "STREAM_CREATED") return context.streams;

    return { ...context.streams, mappingStream: event.stream };
  },
});

export const setLocalStepsStream = assign({
  streams: ({ context, event }) => {
    if (event.type !== "STREAM_CREATED") return context.streams;

    return { ...context.streams, localStepsStream: event.stream };
  },
});

export const setPersistingStream = assign({
  streams: ({ context, event }) => {
    if (event.type !== "STREAM_CREATED") return context.streams;

    return { ...context.streams, persistingStream: event.stream };
  },
});

export const streamsActions = {
  setImporterStream,
  setMappingStream,
  setLocalStepsStream,
  setPersistingStream,
} as Record<StreamsActions, any>;
