export type ErrorEvent = {
  type: "ERROR";
  error: Error;
  expected: boolean;
  id: string;
  step: string;
};

export const errorEventGen = {
  unexpected: ({ id }: { id: string }, error: unknown, step: string): ErrorEvent => {
    const errorObj =
      error instanceof Error ? error : new Error(`Unexpected error: ${error as string}`);

    return {
      type: "ERROR" as const,
      error: errorObj,
      expected: false,
      id: id,
      step: step,
    };
  },

  expected: ({ id }: { id: string }, error: unknown, step: string) => {
    const errorObj =
      error instanceof Error ? error : new Error(`Expected error: ${error as string}`);

    return {
      type: "ERROR" as const,
      error: errorObj,
      expected: true,
      id: id,
      step: step,
    };
  },
};
