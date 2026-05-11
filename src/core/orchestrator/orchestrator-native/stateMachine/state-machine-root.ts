import { raise, setup } from "xstate";
import { stateMachineInitializing } from "./states/state-machine-initializing";
import type { OrchestratorContext } from "./schemes/context";
import { EMPTY_CONTEXT } from "./schemes/context";
import type { OrchestratorActions } from "./actions";
import { ACTIONS } from "./actions";
import type { OrchestratorEvents } from "./events";
import { stateMachineReadingData } from "./states/state-machine-reading-data";
import { stateMachineWaitingInteractions } from "./states/state-machine-waiting-interactions";
import type { OrchestratorActors } from "./actors";
import { ACTORS } from "./actors";
import { logEventGen } from "./events/log";
import { STEPS } from "./consts/steps";
import { stateMachineEditing } from "./states/state-machine-editing";
import type { OrchestratorGuards } from "./guards";
import { GUARDS } from "./guards";
import { stateMachineError } from "./states/state-machine-error";
import { stateMachineResetting } from "./states/state-machine-resetting";
import { defaultState } from "./actions/reset";

export const mainStateMachineSetup = setup({
  types: {
    context: {} as OrchestratorContext,
    events: {} as OrchestratorEvents,
  },
  actions: ACTIONS as Record<OrchestratorActions, any>,
  actors: ACTORS as Record<OrchestratorActors, any>,
  guards: GUARDS as Record<OrchestratorGuards, any>,
});

export const mainStateMachine = (orchestratorContext: Partial<OrchestratorContext>) => {
  return mainStateMachineSetup.createMachine({
    id: "root",
    context: {
      ...EMPTY_CONTEXT,
      ...defaultState,
      ...orchestratorContext,
    } as OrchestratorContext,
    initial: "initializing",
    states: {
      initializing: stateMachineInitializing,
      working: {
        type: "parallel",
        states: {
          readingData: stateMachineReadingData,
          waitingInteractions: stateMachineWaitingInteractions,
          editing: stateMachineEditing,
        },
      },
      error: stateMachineError,
      resetting: stateMachineResetting,
    },

    on: {
      LOG: {
        actions: "log",
      },
      ERROR: {
        actions: [
          "registerError",
          raise(({ self, event }) =>
            logEventGen.error(
              self,
              `${event.expected ? "expected" : "unexpected"} error found in step ${event.step}: ${event.error} `,
              STEPS.ERROR_HANDLING
            )
          ),
        ],
        target: "#root.error",
      },
      PROGRESS_UPDATED: {
        actions: "updateProgress",
      },
      FINISHED_READING_DATA: {
        actions: "clearReadingDataActors",
      },
      RESET: {
        target: "#root.resetting",
      },
    },
  }) as any;
};
