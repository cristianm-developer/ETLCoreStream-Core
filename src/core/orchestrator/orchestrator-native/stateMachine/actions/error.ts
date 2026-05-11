import { assign } from "xstate";
import { mainStateMachineSetup } from "../state-machine-root";

export const registerErrorAction = mainStateMachineSetup.createAction(
  assign(({ event, context }) => {
    if (event.type !== "ERROR") {
      return context;
    }
    return {
      errors: {
        expected: event.expected ? event.error : null,
        unexpected: event.expected ? null : event.error,
      },
    };
  })
);
