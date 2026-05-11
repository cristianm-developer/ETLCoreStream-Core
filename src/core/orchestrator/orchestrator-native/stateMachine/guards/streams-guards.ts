import type { OrchestratorContext } from "../schemes/context";

export const hasImporterStream = ({ context }: { context: OrchestratorContext }) =>
  !!context.streams.importStream;
export const hasMappingStream = ({ context }: { context: OrchestratorContext }) =>
  !!context.streams.mappingStream;
export const hasLocalStepsStream = ({ context }: { context: OrchestratorContext }) =>
  !!context.streams.localStepsStream;

export const streamsGuards = {
  hasImporterStream: hasImporterStream,
  hasMappingStream: hasMappingStream,
  hasLocalStepsStream: hasLocalStepsStream,
};

export type StreamsGuards = keyof typeof streamsGuards;
