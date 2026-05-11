import type { OrchestratorContext } from "../schemes/context";

export const hasFileGuard = ({ context }: { context: OrchestratorContext }) => !!context.file;
