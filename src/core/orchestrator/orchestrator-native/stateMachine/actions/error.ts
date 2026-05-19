import { assign } from "xstate";

export const registerErrorAction = assign(({ event, context }) => {
  if (event.type !== "ERROR") {
    return context;
  }
  return {
    errors: {
      expected: event.expected ? event.error : null,
      unexpected: event.expected ? null : event.error,
    },
  };
});
