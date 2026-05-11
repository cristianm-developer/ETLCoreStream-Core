import type { OrchestratorContext } from "../schemes/context";

export const hasExpextedErrorGuard = ({ context }: { context: OrchestratorContext }) =>
  !!context.errors.expected;
export const hasUnexpectedErrorGuard = ({ context }: { context: OrchestratorContext }) =>
  !!context.errors.unexpected;
