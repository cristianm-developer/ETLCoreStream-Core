import { assign, raise } from "xstate";
import { mainStateMachineSetup } from "../state-machine-setup";
import { logEventGen } from "../events/log";
import { STEPS } from "../consts/steps";

export const stateMachineResetting = mainStateMachineSetup.createStateConfig({
  id: "resetting",
  entry: [
    raise(({ self }) =>
      logEventGen.info(self, "Resetting orchestrator", STEPS.RESETING_ORCHESTRATOR)
    ),
    assign({ step: ({ context }) => [...context.step, STEPS.RESETING_ORCHESTRATOR] }),
    "resetOrchestrator",
  ],
  always: {
    target: "#root.initializing",
  },
  exit: [
    assign({
      step: ({ context }) =>
        context.step?.filter((step) => step !== STEPS.RESETING_ORCHESTRATOR) ?? [],
    }),
  ],
});
