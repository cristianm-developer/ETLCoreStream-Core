import { and, assign, raise } from "xstate";
import { STEPS } from "../consts/steps";
import { logEventGen } from "../events/log";
import { mainStateMachineSetup } from "../state-machine-setup";
import type { OrchestratorContext } from "../schemes/context";
import { errorEventGen } from "../events/error";
import type { FileMetrics, RowObject } from "@/shared";
import type { ChangeFilterEvent, ChangePageEvent } from "../events/user-events";
import type { MetricsUpdatingHandlerInput } from "../actors/metrics-updating-handler";

export const stateMachineWaitingInteractions = mainStateMachineSetup.createStateConfig({
  id: "waitingInteractions",
  initial: "waitingProcessing",
  states: {
    waitingProcessing: {
      entry: [
        raise(({ self }) =>
          logEventGen.info(
            self,
            "Waiting for processing",
            STEPS.WAITING_INTERACTIONS.WAITING_PROCESSING
          )
        ),
        assign({
          step: ({ context }) => [
            ...(context.step ?? []),
            STEPS.WAITING_INTERACTIONS.WAITING_PROCESSING,
          ],
        }),
      ],
      always: [
        {
          target: "readingRows",
          guard: and(["isNotProccessingRows", "isInitialProcessingDone"]),
        },
      ],
      exit: [
        assign({
          step: ({ context }) =>
            context.step?.filter(
              (step) => step !== STEPS.WAITING_INTERACTIONS.WAITING_PROCESSING
            ) ?? [],
        }),
      ],
    },

    readingRows: {
      entry: [
        raise(({ self }) =>
          logEventGen.info(self, "Reading rows", STEPS.WAITING_INTERACTIONS.READING_ROWS)
        ),
        assign({
          step: ({ context }) => [...(context.step ?? []), STEPS.WAITING_INTERACTIONS.READING_ROWS],
        }),
      ],
      invoke: {
        src: "rowsReader",
        input: ({ context }: { context: OrchestratorContext }) => ({
          persistenceModule: context.modules!.persistence!,
          viewerModule: context.modules!.viewer!,
          filter: context.viewPaginationInfo?.currentFilter ?? {},
          pageNumber: context.viewPaginationInfo?.currentPage ?? 1,
        }),
        onError: [
          {
            actions: [
              raise(({ self, event }) =>
                errorEventGen.unexpected(self, event.error, STEPS.WAITING_INTERACTIONS.READING_ROWS)
              ),
            ],
          },
        ],
        onDone: [
          {
            actions: [assign({ currentRows: ({ event }) => event.output as RowObject[] })],
            target: "waitingMetrics",
          },
        ],
      },
      exit: [
        assign({
          step: ({ context }) =>
            context.step?.filter((step) => step !== STEPS.WAITING_INTERACTIONS.READING_ROWS) ?? [],
        }),
      ],
    },

    waitingMetrics: {
      entry: [
        raise(({ self }) =>
          logEventGen.info(self, "Waiting for metrics", STEPS.WAITING_INTERACTIONS.WAITING_METRICS)
        ),
        assign({
          step: ({ context }) => [...context.step, STEPS.WAITING_INTERACTIONS.WAITING_METRICS],
        }),
      ],
      always: [
        {
          target: "waitingUser",
          guard: and(["isInitialProcessingDone", "hasMetrics"]),
        },
      ],
      exit: [
        assign({
          step: ({ context }) =>
            context.step?.filter((step) => step !== STEPS.WAITING_INTERACTIONS.WAITING_METRICS) ??
            [],
        }),
      ],
    },

    waitingUser: {
      entry: [
        raise(({ self }) =>
          logEventGen.info(self, "Waiting for user", STEPS.WAITING_INTERACTIONS.WAITING_USER)
        ),
        assign({
          step: ({ context }) => [...context.step, STEPS.WAITING_INTERACTIONS.WAITING_USER],
        }),
      ],
      always: [
        {
          target: "waitingProcessing",
          guard: "isProcessingRows",
        },
      ],
      on: {
        CHANGE_PAGE: {
          actions: [
            assign({
              viewPaginationInfo: ({
                event,
                context,
              }: {
                event: ChangePageEvent;
                context: OrchestratorContext;
              }) => ({
                ...(context.viewPaginationInfo ?? {
                  currentFilter: {},
                  currentPage: 1,
                  totalPages: 1,
                }),
                currentPage: event.pageNumber ?? 1,
              }),
            }),
          ],
          target: "readingRows",
        },
        CHANGE_FILTER: {
          actions: [
            assign({
              viewPaginationInfo: ({
                event,
                context,
              }: {
                event: ChangeFilterEvent;
                context: OrchestratorContext;
              }) => ({
                ...(context.viewPaginationInfo ?? {
                  currentFilter: {},
                  currentPage: 1,
                  totalPages: 1,
                }),
                currentPage: 1,
                currentFilter: event.filter ?? {},
              }),
            }),
          ],

          target: "updatingMetrics",
        },
      },
      exit: [
        assign({
          step: ({ context }) =>
            context.step?.filter((step) => step !== STEPS.WAITING_INTERACTIONS.WAITING_USER) ?? [],
        }),
      ],
    },
    updatingMetrics: {
      entry: [
        raise(({ self }) => logEventGen.info(self, "Waiting for metrics", STEPS.UPDATING_METRICS)),
        assign({
          step: ({ context }) => [...context.step, STEPS.WAITING_INTERACTIONS.WAITING_METRICS],
        }),
      ],
      invoke: {
        src: "metricsUpdatingHandler",
        input: ({ context }: { context: OrchestratorContext }) =>
          ({
            persistingModule: context.modules!.persistence!,
            file: context.file!,
            viewerModule: context.modules!.viewer!,
            filter: context.viewPaginationInfo?.currentFilter ?? {},
          }) satisfies MetricsUpdatingHandlerInput,
        onError: {
          actions: [
            raise(({ self, event }) =>
              errorEventGen.unexpected(self, event.error, STEPS.EDITING.UPDATING_METRICS)
            ),
          ],
        },
        onDone: {
          target: "readingRows",
          actions: [
            assign(({ event, context }) => {
              const result = event.output as { metrics: FileMetrics; totalPages: number };

              return {
                metrics: result.metrics,
                viewPaginationInfo: {
                  currentPage: context.viewPaginationInfo?.currentPage ?? 1,
                  totalPages: result.totalPages,
                  currentFilter: context.viewPaginationInfo?.currentFilter ?? {},
                },
              };
            }),
          ],
        },
      },
      exit: [
        assign({
          step: ({ context }) =>
            context.step?.filter((step) => step !== STEPS.WAITING_INTERACTIONS.WAITING_METRICS) ??
            [],
        }),
      ],
    },
  },
});
