import type { ErrorActorEvent } from "xstate";
import { assign, raise } from "xstate";
import { STEPS } from "../consts/steps";
import { errorEventGen } from "../events/error";
import { logEventGen } from "../events/log";
import { mainStateMachineSetup } from "../state-machine-root";
import type { OrchestratorContext } from "../schemes/context";

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
      ],
      always: {
        target: "cleaningPersistence",
      },
      exit: [
        assign({
          step: ({ context }) =>
            context.step?.filter((step) => step !== STEPS.INITIALIZING_MACHINE) ?? [],
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
