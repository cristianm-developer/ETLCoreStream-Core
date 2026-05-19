import { assign } from "xstate";

export const setLayoutAction = assign({
  layout: ({ event, context }) => {
    if (event.type !== "LAYOUT_SELECTED") {
      return context.layout;
    }
    return event.layout;
  },
});

export const setFileAction = assign({
  file: ({ event, context }) => {
    if (event.type !== "FILE_SELECTED") return context.file;
    return event.file;
  },
});
