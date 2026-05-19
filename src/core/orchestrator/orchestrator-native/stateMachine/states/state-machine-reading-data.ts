import { and, assign, or, raise, spawnChild } from "xstate";
import { STEPS } from "../consts/steps";
import { logEventGen } from "../events/log";
import { mainStateMachineSetup } from "../state-machine-setup";
import type { OrchestratorContext } from "../schemes/context";
import { errorEventGen } from "../events/error";
import type { FileMetrics } from "@/shared";
import { ACTORS_IDS } from "../consts/actors-ids";
import type { MetricsUpdatingHandlerInput } from "../actors/metrics-updating-handler";
import type { GlobalStepsHandlerInput } from "../actors/global-steps-handler";
import type { ImporterHandlerInput } from "../actors/importer-handler";
import type { MappingHandlerInput } from "../actors/mapping-handler";
import type { LocalStepsHandlerInput } from "../actors/local-steps-handler";
import type { PersistenceHandlerInput } from "../actors/persistence-handler";
import type { RecoverPointUpdatingHandlerInput } from "../actors/recover-point-handler";
import type { RecoverPoint } from "@/shared/schemes/recover-point";

export const stateMachineReadingData = mainStateMachineSetup.createStateConfig({
  id: "readingData",
  entry: [
    raise(({ self }) =>
      logEventGen.info(self, "Reading data initializing", STEPS.READING_DATA.INITIALIZING)
    ),
  ],
  initial: "recoverRouting",
  states: {
    recoverRouting: {
      always: [
        {
          guard: or(["canSkipRecoveryPoint", "hasDecisionToNotRecoverPoint"]),
          target: "waitingInputs",
        },
        {
          guard: and(["hasDecisionToRecoverPoint", "canRecoverPoint"]),
          target: "#readingData.processingInputs.done",
        },
      ],
    },
    waitingInputs: {
      initial: "waitingLayout",
      entry: [
        raise(({ self }) =>
          logEventGen.info(self, "Waiting for inputs", STEPS.READING_DATA.WAITING_INPUTS)
        ),
      ],
      states: {
        waitingLayout: {
          entry: [
            raise(({ self }) =>
              logEventGen.info(self, "Waiting for layout", STEPS.READING_DATA.WAITING_LAYOUT)
            ),
            assign({
              step: ({ context }) => [...(context.step ?? []), STEPS.READING_DATA.WAITING_LAYOUT],
            }),
          ],

          on: {
            LAYOUT_SELECTED: [
              {
                actions: [
                  "setLayout",
                  raise(({ self }) =>
                    logEventGen.info(self, "Layout selected", STEPS.READING_DATA.WAITING_LAYOUT)
                  ),
                ],
                target: "waitingFile",
              },
            ],
          },
          exit: [
            assign({
              step: ({ context }) =>
                context.step?.filter((step) => step !== STEPS.READING_DATA.WAITING_LAYOUT) ?? [],
            }),
          ],
        },
        waitingFile: {
          entry: [
            raise(({ self }) =>
              logEventGen.info(self, "Waiting for file", STEPS.READING_DATA.WAITING_FILE)
            ),
            assign({
              step: ({ context }) => [...(context.step ?? []), STEPS.READING_DATA.WAITING_FILE],
            }),
          ],
          on: {
            FILE_SELECTED: [
              {
                actions: [
                  "setFile",
                  raise(({ self }) =>
                    logEventGen.info(self, "File selected", STEPS.READING_DATA.WAITING_FILE)
                  ),
                ],
                target: "#readingData.processingInputs",
              },
            ],
          },
          exit: [
            assign({
              step: ({ context }) =>
                context.step?.filter((step) => step !== STEPS.READING_DATA.WAITING_FILE) || [],
            }),
          ],
        },
      },
    },
    processingInputs: {
      initial: "importing",
      entry: [
        raise(({ self }) =>
          logEventGen.info(self, "Processing inputs started", STEPS.READING_DATA.PROCESSING_INPUTS)
        ),
        assign({ processingRows: true }),
        assign({
          step: ({ context }) => [...(context.step ?? []), STEPS.READING_DATA.PROCESSING_INPUTS],
        }),
      ],
      states: {
        importing: {
          entry: [
            raise(({ self }) =>
              logEventGen.info(self, "Importing data", STEPS.READING_DATA.IMPORTING_DATA)
            ),
            raise(({ self }) =>
              logEventGen.debug(
                self,
                "Creating importer handler",
                STEPS.READING_DATA.IMPORTING_DATA
              )
            ),
            assign(({ context }) => ({
              step: [...(context.step ?? []), STEPS.READING_DATA.IMPORTING_DATA],
            })),
            spawnChild(ACTORS_IDS.IMPORTER_HANDLER, {
              id: "importerHandlerActor",
              input: ({ context }: { context: OrchestratorContext }) =>
                ({
                  file: context.file,
                  importerModule: context.modules!.importer!,
                  abortSignal: context.abortController.signal,
                }) satisfies ImporterHandlerInput,
            }),
          ],
          exit: [
            assign(({ context }) => ({
              step:
                context.step?.filter((step) => step !== STEPS.READING_DATA.IMPORTING_DATA) ?? [],
            })),
          ],

          on: {
            STREAM_CREATED: {
              actions: ["setImporterStream"],
              target: "mapping",
            },
          },
        },

        mapping: {
          entry: [
            raise(({ self }) =>
              logEventGen.info(self, "Starting Mapping data", STEPS.READING_DATA.MAPPING_DATA)
            ),
            assign(({ context }) => ({
              step: [...(context.step ?? []), STEPS.READING_DATA.MAPPING_DATA],
            })),
            spawnChild(ACTORS_IDS.MAPPING_HANDLER, {
              id: "mappingHandlerActor",
              input: ({ context }: { context: OrchestratorContext }) =>
                ({
                  mappingModule: context.modules!.mapper!,
                  stream: context.streams.importStream!,
                  layout: context.layout!,
                  totalEstimatedRows: context.totalEstimatedRows!,
                  abortSignal: context.abortController.signal,
                }) satisfies MappingHandlerInput,
            }),
          ],
          exit: [
            assign(({ context }) => ({
              step: context.step?.filter((step) => step !== STEPS.READING_DATA.MAPPING_DATA) ?? [],
            })),
          ],
          on: {
            STREAM_CREATED: {
              actions: ["setMappingStream"],
              target: "handlingLocalSteps",
            },
          },
        },

        handlingLocalSteps: {
          entry: [
            raise(({ self }) =>
              logEventGen.info(
                self,
                "Handling local steps",
                STEPS.READING_DATA.HANDLING_LOCAL_STEPS
              )
            ),
            assign(({ context }) => ({
              step: [...(context.step ?? []), STEPS.READING_DATA.HANDLING_LOCAL_STEPS],
            })),
            spawnChild(ACTORS_IDS.LOCAL_STEPS_HANDLER, {
              id: "localStepsHandlerActor",
              input: ({ context }: { context: OrchestratorContext }) =>
                ({
                  localStepEngine: context.modules!.localStepEngine!,
                  stream: context.streams.mappingStream!,
                  layout: context.layout,
                  totalEstimatedRows: context.totalEstimatedRows,
                  abortSignal: context.abortController.signal,
                }) satisfies LocalStepsHandlerInput,
            }),
          ],
          exit: [
            assign(({ context }) => ({
              step:
                context.step?.filter((step) => step !== STEPS.READING_DATA.HANDLING_LOCAL_STEPS) ??
                [],
            })),
          ],
          on: {
            STREAM_CREATED: {
              actions: ["setLocalStepsStream"],
              target: "persisting",
            },
          },
        },

        persisting: {
          entry: [
            raise(({ self }) =>
              logEventGen.info(self, "Persisting data", STEPS.READING_DATA.PERSISTING_DATA)
            ),
            assign(({ context }) => ({
              step: [...(context.step ?? []), STEPS.READING_DATA.PERSISTING_DATA],
            })),
            spawnChild("persistenceHandler", {
              id: "persistenceHandlerActor",
              input: ({ context }: { context: OrchestratorContext }) =>
                ({
                  persistenceModule: context.modules!.persistence!,
                  stream: context.streams.localStepsStream!,
                  totalEstimatedRows: context.totalEstimatedRows!,
                  abortSignal: context.abortController.signal,
                }) satisfies PersistenceHandlerInput,
            }),
          ],
          exit: [
            assign(({ context }) => ({
              step:
                context.step?.filter((step) => step !== STEPS.READING_DATA.PERSISTING_DATA) ?? [],
            })),
          ],
          on: {
            FIRST_CHUNK_RAW_READY: {
              target: "handlingGlobalSteps",
              actions: [
                raise(({ self }) =>
                  logEventGen.info(
                    self,
                    "First chunk raw ready",
                    STEPS.READING_DATA.PERSISTING_DATA
                  )
                ),
              ],
            },
          },
        },

        handlingGlobalSteps: {
          entry: [
            raise(({ self }) =>
              logEventGen.info(
                self,
                "Handling global steps",
                STEPS.READING_DATA.HANDLING_GLOBAL_STEPS
              )
            ),
            assign(({ context }) => ({
              step: [...(context.step ?? []), STEPS.READING_DATA.HANDLING_GLOBAL_STEPS],
            })),
            spawnChild("globalStepsHandler", {
              id: "globalStepsHandlerActor",
              input: ({ context }: { context: OrchestratorContext }) =>
                ({
                  globalStepsEngineModule: context.modules!.globalStepEngine!,
                  persistingModule: context.modules!.persistence!,
                  layout: context.layout!,
                  totalEstimatedRows: context.totalEstimatedRows!,
                  viewModule: context.modules!.viewer!,
                  viewPageSize: context.settings.viewer.defaultPageSize ?? 100,
                  abortSignal: context.abortController.signal,
                }) satisfies GlobalStepsHandlerInput,
            }),
          ],
          exit: [
            assign(({ context }) => ({
              step:
                context.step?.filter((step) => step !== STEPS.READING_DATA.HANDLING_GLOBAL_STEPS) ??
                [],
            })),
          ],
          on: {
            FINISHED_GLOBAL_STEPS: {
              actions: [
                raise(({ self }) =>
                  logEventGen.info(
                    self,
                    "Finished global steps",
                    STEPS.READING_DATA.HANDLING_GLOBAL_STEPS
                  )
                ),
                assign(({ context }) => ({ initialGlobalStepsDone: true })),
              ],
            },
          },
          always: {
            target: "updatingMetrics",
            guard: ({ context }) =>
              context.initialPersistenceDone === true && context.initialGlobalStepsDone === true,
          },
        },

        updatingMetrics: {
          entry: [
            raise(({ self }) => logEventGen.info(self, "Updating metrics", STEPS.UPDATING_METRICS)),
            assign(({ context }) => ({ step: [...(context.step ?? []), STEPS.UPDATING_METRICS] })),
          ],
          initial: "updatingMetrics",

          states: {
            updatingMetrics: {
              invoke: {
                src: "metricsUpdatingHandler",
                input: ({ context }: { context: OrchestratorContext }) =>
                  ({
                    persistingModule: context.modules!.persistence!,
                    file: context.file,
                    viewerModule: context.modules!.viewer!,
                    filter: context.viewPaginationInfo?.currentFilter ?? {},
                  }) as MetricsUpdatingHandlerInput,
                onError: {
                  actions: [
                    raise(({ self, event }) =>
                      errorEventGen.unexpected(
                        self,
                        (event as unknown as ErrorEvent).error,
                        STEPS.UPDATING_METRICS
                      )
                    ),
                  ],
                },
                onDone: {
                  target: "updatingRecoverPoint",
                  actions: [
                    raise(({ self }) =>
                      logEventGen.info(self, "Metrics updated", STEPS.UPDATING_METRICS)
                    ),
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
            },
            updatingRecoverPoint: {
              invoke: {
                src: "recoverPointUpdatingHandler",
                input: ({ context }: { context: OrchestratorContext }) =>
                  ({
                    persistenceModule: context.modules!.persistence!,
                    recoverModule: context.modules!.recover!,
                    metrics: context.metrics!,
                    layout: context.layout!,
                  }) satisfies RecoverPointUpdatingHandlerInput,
                onError: {
                  actions: [
                    raise(({ self, event }) =>
                      errorEventGen.unexpected(
                        self,
                        (event as unknown as ErrorEvent).error,
                        STEPS.RECOVERING.UPDATING_RECOVERY_POINT
                      )
                    ),
                  ],
                },
                onDone: {
                  target: "#readingData.processingInputs.done",
                  actions: [
                    assign(({ event }) => ({ recoveryPoint: event.output as RecoverPoint })),
                  ],
                },
              },
            },
          },
          exit: [
            assign(({ context }) => ({
              step: context.step?.filter((step) => step !== STEPS.UPDATING_METRICS) ?? [],
            })),
          ],
        },
        done: {
          type: "final",
          entry: [
            raise(({ self }) =>
              logEventGen.info(self, "Reading data finished", STEPS.READING_DATA.PROCESSING_INPUTS)
            ),
            assign({
              processingRows: false,
              streams: {
                importStream: null,
                mappingStream: null,
                localStepsStream: null,
              },
              totalEstimatedRows: null,
              initialProcessingDone: true,
            }),
            assign({
              step: ({ context }) =>
                context.step?.filter((step) => step !== STEPS.READING_DATA.PROCESSING_INPUTS) ?? [],
            }),
          ],
        },
      },

      onDone: {
        actions: [],
      },

      on: {
        FINISHED_PERSISTENCE: {
          actions: [
            raise(({ self }) =>
              logEventGen.info(self, "Finished persisting data", STEPS.READING_DATA.PERSISTING_DATA)
            ),
            assign(({ context }) => ({ initialPersistenceDone: true })),
          ],
        },
        FIRST_CHUNK_PROCESSED_READY: {
          actions: [
            raise(({ self }) =>
              logEventGen.info(
                self,
                "First chunk processed ready",
                STEPS.READING_DATA.PERSISTING_DATA
              )
            ),
            assign({ currentRows: ({ event }) => event.rows }),
          ],
        },
      },
      exit: [],
    },
  },
});
