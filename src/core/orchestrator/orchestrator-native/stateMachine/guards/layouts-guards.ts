import type { OrchestratorContext } from "../schemes/context";

export const hasLayoutGuard = ({ context }: { context: OrchestratorContext }) => !!context.layout;
