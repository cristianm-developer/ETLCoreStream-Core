import { assign } from "xstate";
import { mainStateMachineSetup } from "../state-machine-root";

export const setLayoutAction = mainStateMachineSetup.createAction(
  assign({
    layout: ({ event, context }) => {
      if (event.type !== "LAYOUT_SELECTED") {
        return context.layout;
      }
      return event.layout;
    },
  })
);

export const setFileAction = mainStateMachineSetup.createAction(
  assign({
    file: ({ event, context }) => {
      if (event.type !== "FILE_SELECTED") return context.file;
      return event.file;
    },
  })
);
