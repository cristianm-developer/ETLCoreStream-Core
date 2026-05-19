import type { ErrorActorEvent } from "xstate";
import { assign, not, raise } from "xstate";
import { STEPS } from "../consts/steps";
import { errorEventGen } from "../events/error";
import { logEventGen } from "../events/log";
import { mainStateMachineSetup } from "../state-machine-setup";
import type { OrchestratorContext } from "../schemes/context";
import type { RecoverPoint } from "@/shared/schemes/recover-point";
import type {
  LoadRecoveryPointInput,
  RecoverPointHandlerInput,
  RecoverPointHandlerOutput,
} from "../actors/recover-point-handler";

export const stateMachineInitializing = mainStateMachineSetup.createStateConfig({
  id: "initializing",
  initial: "initializing",
  states: {
    initializing: {
      entry: [
        raise(({ self }) =>
          logEventGen.info(self, "Initializing state machine", STEPS.INITIALIZING_MACHINE)
        ),
        assign({ step: ({ context }) => [...(context.step ?? []), STEPS.INITIALIZING_MACHINE] }),
        assign(({ context }) => ({
          checkRecoverPoint: context.settings.recover.checkRecoveryPoint ?? false,
        })),
      ],
      always: [
        {
          target: "#initializing.checkingRecoveryPoint",
          guard: not("canSkipRecoveryPoint"),
        },
        {
          target: "#initializing.cleaningPersistence",
          guard: "canSkipRecoveryPoint",
        },
      ],
      exit: [
        assign({
          step: ({ context }) =>
            context.step?.filter((step) => step !== STEPS.INITIALIZING_MACHINE) ?? [],
        }),
      ],
    },
    checkingRecoveryPoint: {
      entry: [
        raise(({ self }) =>
          logEventGen.info(
            self,
            "Checking recovery point",
            STEPS.RECOVERING.CHECKING_RECOVERY_POINT
          )
        ),
        assign({
          step: ({ context }) => [
            ...(context.step ?? []),
            STEPS.RECOVERING.CHECKING_RECOVERY_POINT,
          ],
        }),
      ],
      initial: "loadingRecoveryPoint",
      states: {
        loadingRecoveryPoint: {
          invoke: {
            src: "loadRecoverPointHandler",
            input: ({ context }: { context: OrchestratorContext }) =>
              ({
                recoverModule: context.modules.recover,
                persistenceModule: context.modules.persistence,
              }) satisfies LoadRecoveryPointInput,
            onDone: {
              actions: assign({
                recoveryPoint: ({ event }) => event.output as RecoverPoint | null,
              }),
              target: "canRecoverRouting",
            },
          },
        },
        canRecoverRouting: {
          always: [
            {
              target: "#initializing.cleaningPersistence",
              guard: not("canRecoverPoint"),
            },
            {
              target: "wantToRecoverRouting",
              guard: "canRecoverPoint",
            },
          ],
        },
        wantToRecoverRouting: {
          entry: [
            assign(({ context }) => ({
              step: [...(context.step ?? []), STEPS.RECOVERING.WAITING_TO_CHOOSE_RECOVER],
            })),
          ],
          on: {
            WANT_TO_RECOVER: {
              target: "recovering",
            },
            WANT_TO_NOT_RECOVER: {
              target: "#initializing.cleaningPersistence",
            },
          },
          always: [
            {
              guard: "hasDecisionToRecoverPoint",
              target: "recovering",
            },
            {
              guard: "hasDecisionToNotRecoverPoint",
              target: "#initializing.cleaningPersistence",
            },
          ],
          exit: [
            assign({
              step: ({ context }) =>
                context.step?.filter(
                  (step) => step !== STEPS.RECOVERING.WAITING_TO_CHOOSE_RECOVER
                ) ?? [],
            }),
          ],
        },
        recovering: {
          entry: [
            raise(({ self }) =>
              logEventGen.info(
                self,
                "Recovering from recovery point",
                STEPS.RECOVERING.RECOVERING_FROM_RECOVERY_POINT
              )
            ),
            assign({
              step: ({ context }) => [
                ...(context.step ?? []),
                STEPS.RECOVERING.RECOVERING_FROM_RECOVERY_POINT,
              ],
            }),
            assign(({ context }) => ({
              wantToRecoverPoint: true,
              recoveryPoint: context.recoveryPoint,
            })),
          ],
          invoke: {
            src: "recoverPointHandler",
            input: ({ context }: { context: OrchestratorContext }) =>
              ({
                recoverModule: context.modules!.recover!,
                persistenceModule: context.modules!.persistence!,
                viewerModule: context.modules!.viewer!,
                recoveryPoint: context.recoveryPoint,
              }) satisfies RecoverPointHandlerInput,
            onDone: {
              actions: assign({
                metrics: ({ event }) => (event.output as RecoverPointHandlerOutput).metrics,
                layout: ({ event }) => (event.output as RecoverPointHandlerOutput).layout,
                file: ({ event }) => (event.output as RecoverPointHandlerOutput).file,
                viewPaginationInfo: ({ event }) => ({
                  totalPages: (event.output as RecoverPointHandlerOutput).totalPages,
                  currentPage: 1,
                  currentFilter: {},
                }),
              }),
              target: "#initializing.final",
            },
            onError: {
              actions: raise(({ self, event }) =>
                errorEventGen.unexpected(
                  self,
                  (event as ErrorActorEvent).error,
                  STEPS.RECOVERING.RECOVERING_FROM_RECOVERY_POINT
                )
              ),
            },
          },
        },
      },
      exit: [
        assign({
          step: ({ context }) =>
            context.step?.filter((step) => step !== STEPS.RECOVERING.CHECKING_RECOVERY_POINT) ?? [],
        }),
      ],
    },
    cleaningPersistence: {
      entry: [
        raise(({ self }) =>
          logEventGen.info(self, "Cleaning persistence", STEPS.CLEANING_PERSISTENCE)
        ),
        assign({ step: ({ context }) => [...(context.step ?? []), STEPS.CLEANING_PERSISTENCE] }),
      ],
      invoke: {
        src: "persistenceCleaner",
        input: ({ context }: { context: OrchestratorContext }) => ({ context }),
        onError: {
          actions: raise(({ self, event }) =>
            errorEventGen.unexpected(
              self,
              (event as ErrorActorEvent).error,
              STEPS.CLEANING_PERSISTENCE
            )
          ),
        },
        onDone: {
          target: "final",
          actions: assign(({ context }) => ({ checkRecoverPoint: false })),
        },
      },
      exit: [
        assign({
          step: ({ context }) =>
            context.step?.filter((step) => step !== STEPS.CLEANING_PERSISTENCE) ?? [],
        }),
      ],
    },
    final: {
      type: "final",
    },
  },
  onDone: {
    target: "#root.working",
  },
});
