import { setup } from "xstate";
import type { OrchestratorEvents } from "./events";
import type { OrchestratorContext } from "./schemes/context";
import type { OrchestratorActions } from "./actions";
import { ACTIONS } from "./actions";
import type { OrchestratorActors } from "./actors";
import { ACTORS } from "./actors";
import type { OrchestratorGuards } from "./guards";
import { GUARDS } from "./guards";

export const mainStateMachineSetup = setup({
  types: {
    context: {} as OrchestratorContext,
    events: {} as OrchestratorEvents,
  },
  actions: ACTIONS as Record<OrchestratorActions, any>,
  actors: ACTORS as Record<OrchestratorActors, any>,
  guards: GUARDS as Record<OrchestratorGuards, any>,
});
