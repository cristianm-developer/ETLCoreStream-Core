import { assign, raise } from "xstate";
import { mainStateMachineSetup } from "../state-machine-root";
import { logEventGen } from "../events/log";
import { STEPS } from "../consts/steps";

export const stateMachineError = mainStateMachineSetup.createStateConfig({
  id: "error",
  initial: "checkingError",
  entry: [assign({ step: ({ context }) => [...context.step, STEPS.ERROR_HANDLING] })],
  exit: [
    assign({
      step: ({ context }) => context.step?.filter((step) => step !== STEPS.ERROR_HANDLING) ?? [],
    }),
  ],
  states: {
    checkingError: {
      always: [
        {
          guard: "hasExpectedError",
          target: "errorExpected",
        },
        {
          guard: "hasUnexpectedError",
          target: "errorUnexpected",
        },
      ],
    },
    errorExpected: {
      entry: [
        raise(({ self }) =>
          logEventGen.error(self, "Expected error found, terminating", STEPS.ERROR_HANDLING)
        ),
      ],
    },
    errorUnexpected: {
      entry: [
        raise(({ self }) =>
          logEventGen.error(self, "Unexpected error found, terminating", STEPS.ERROR_HANDLING)
        ),
      ],
    },
  },
});
