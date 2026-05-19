import type { OrchestratorContext } from "../schemes/context";

export const canRecoverPointGuard = ({ context }: { context: OrchestratorContext }) => {
  if (context.recoveryPoint != null) {
    return true;
  } else {
    return false;
  }
};

export const canSkipRecoveryPointGuard = ({ context }: { context: OrchestratorContext }) => {
  if (context.checkRecoverPoint == false) {
    return true;
  }

  return false;
};

export const hasDecisionToRecoverPointGuard = ({ context }: { context: OrchestratorContext }) => {
  if (
    context.checkRecoverPoint &&
    context.recoveryPoint != null &&
    context.wantToRecoverPoint != null &&
    context.wantToRecoverPoint == true
  ) {
    return true;
  }
  return false;
};

export const hasDecisionToNotRecoverPointGuard = ({
  context,
}: {
  context: OrchestratorContext;
}) => {
  if (
    context.checkRecoverPoint &&
    context.recoveryPoint != null &&
    context.wantToRecoverPoint != null &&
    context.wantToRecoverPoint == false
  ) {
    return true;
  }
  return false;
};

export type RecoverPointGuards =
  | "canRecoverPoint"
  | "canSkipRecoveryPoint"
  | "hasDecisionToRecoverPoint"
  | "hasDecisionToNotRecoverPoint";
export const recoverPointGuards: Record<
  RecoverPointGuards,
  ({ context }: { context: OrchestratorContext }) => boolean
> = {
  canRecoverPoint: canRecoverPointGuard,
  canSkipRecoveryPoint: canSkipRecoveryPointGuard,
  hasDecisionToRecoverPoint: hasDecisionToRecoverPointGuard,
  hasDecisionToNotRecoverPoint: hasDecisionToNotRecoverPointGuard,
};
