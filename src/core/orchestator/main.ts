import { LayoutBase } from "@/shared/schemes/layout-base";
import { ILoggerModule } from "../logger/i-logger-module";
import { ProviderModule } from "../provider/main";
import { IOrchestatorModule } from "./i-orchestator-module";
import { OrchestatorContext } from "./schemes/orchestator-context";
import { BehaviorSubject, Observable } from "rxjs";
import { OrchestatorStateType } from "./schemes/orchestator-states";
import { Log } from "@/shared/schemes/log";
import { ActorRefFrom, assign, createActor, createMachine, fromPromise, setup, Subscription } from "xstate";
import { Signal, signal } from "@preact/signals-core";
import { OrchestatorEvent } from "./schemes/orchestator-event";
import { RowObject } from "@/shared/schemes/row-object";
import { ValidationError } from "@/shared/schemes/local-step-validators";


const DEFAULT_CONTEXT: OrchestatorContext = {
    file: null,
    layout: null,
    metrics: {
        totalRows: 0,
        processedRows: 0,
        errorCount: 0,
    },
    progress: [],
    activeStream: null,
    unexpectedError: null,
    editingRow: null,
    removingRow: null,
    exporting: null,
    currentRowsFilter: null,
    currentRows: null,
    currentErrors: null,
    pageNumber: 1,
    totalEstimatedRows: 0,
}

export class OrchestatorModule {

    private id: string;

    private actor: ActorRefFrom<ReturnType<typeof createMachine>> | undefined;
    private machine: ReturnType<typeof createMachine> | undefined;

    private provider: ProviderModule;
    private logger: ILoggerModule;

    private stateSubject: BehaviorSubject<OrchestatorStateType> = new BehaviorSubject<OrchestatorStateType>('initializing');
    private contextSubject: BehaviorSubject<OrchestatorContext> = new BehaviorSubject<OrchestatorContext>(DEFAULT_CONTEXT);
    private metricsSubject: BehaviorSubject<OrchestatorContext['metrics']> = new BehaviorSubject<OrchestatorContext['metrics']>(DEFAULT_CONTEXT.metrics);

    private actorSubscription: Subscription | undefined;

    private stateSignal: Signal<OrchestatorStateType> = signal<OrchestatorStateType>('initializing');
    get state() {
        return this.stateSignal.value;
    }
    state$: Observable<OrchestatorStateType>;
    private metricsSignal: Signal<OrchestatorContext['metrics']> = signal<OrchestatorContext['metrics']>(DEFAULT_CONTEXT.metrics);
    get metrics() {
        return this.metricsSignal?.value;
    }
    metrics$: Observable<OrchestatorContext['metrics']>;

    context$: Observable<OrchestatorContext>;
    logs$: Observable<Log>;

    setLayout: (layout: LayoutBase) => void;
    getLayout: () => LayoutBase | null;

    getId = (): string => this.id;
    getCurrentState = (): string => {
        const snapshot = this.actor?.getSnapshot();
        const value = snapshot?.value;
        if (typeof value === 'string') {
            return value;
        }
        if (typeof value === 'object' && value !== null) {
            return Object.keys(value)[0] as string;
        }
        return value as unknown as string;
    };
    getCurrentContext = (): OrchestatorContext => this.actor?.getSnapshot().context as OrchestatorContext;


    initialize = (provider: ProviderModule, id?: string): void => {
        this.id = id ?? crypto.randomUUID();
        this.provider = provider;
        this.logger = this.provider.modules.logger;

        this.logs$ = this.logger.logs$;
        this.createMachine();
        this.start();
    }

    private createMachine = () => {
        if (this.actor)
            return;

        this.machine = createMachine(
            {
                id: `ETL-${this.id}`,
                initial: 'initializing',
                context: DEFAULT_CONTEXT,
                types: {} as {
                    context:  OrchestatorContext,
                    events: OrchestatorEvent,
                    children: {
                        "import-file": { output: ReadableStream<any> };
                        "mapping": { output: {metrics: {totalRows: number, processedRows: number, errorCount: number}} };
                        "handling-local-step": { output: {metrics: {totalRows: number, processedRows: number, errorCount: number}} };
                        "persisting": { output: {metrics: {totalRows: number, processedRows: number, errorCount: number}} };
                        "handle-global-steps": { output: {metrics: {totalRows: number, processedRows: number, errorCount: number}} };
                        "loading-rows": { output: {metrics: {totalRows: number, processedRows: number, errorCount: number}} };
                        "editing-data": { output: {metrics: {totalRows: number, processedRows: number, errorCount: number}} };
                        "local-step-pipe": { output: ReadableStream<any> };
                        "global-step-pipe": { output: ReadableStream<any> };
                        "cleaning": { output: undefined };
                        "removing-row": { output: undefined };
                        "exporting": { output: undefined };
                    }
                } as any,
                states: {
                    initializing: {
                        id: 'ETL-initializing',
                        entry: () => [
                            this.logger.log('Orchestrator initializing...', 'info', 'initializing', this.id),
                            assign(DEFAULT_CONTEXT)
                        ],
                        always: {
                            target: 'waiting-layout',
                        }

                    },
                    'waiting-layout': {
                        entry: () => {
                            this.logger.log('Orchestrator waiting for layout...', 'info', 'waiting-layout', this.id);
                        },
                        on: {
                            LAYOUT_SELECTED: {
                                target: 'waiting-file',
                                actions: assign({ layout: ({ event }) => event.layout }),
                            }
                        }
                    },
                    'waiting-file': {
                        entry: () => {
                            this.logger.log('Orchestrator waiting for file...', 'info', 'waiting-file', this.id);
                        },
                        on: {
                            FILE_SELECTED: {
                                target: 'importing',
                                actions: assign({ file: ({ event }) => event.file }),
                            }
                        }
                    },
                    importing: {
                        entry: () => {
                            this.logger.log('Importing file...', 'info', 'importing', this.id);
                        },
                        invoke: {
                            id: 'import-file',
                            src: 'importFile',
                            input: ({ context }) => ({ file: context.file }),
                            onDone: {
                                target: 'mapping',
                                actions: assign({ activeStream: ({ event }) => event.output })
                            },
                            onError: {
                                target: 'error',
                                actions: assign(({ event }) => ({ unexpectedError: event.error.toString() })),
                            }
                        }
                    },
                    mapping: {
                        entry: () => {
                            this.logger.log('Mapping file...', 'info', 'mapping', this.id);
                        },
                        invoke: {
                            id: 'mapping',
                            src: 'mapping',
                            input: ({ context }) => ({ activeStream: context.activeStream, layout: context.layout, totalEstimatedRows: context.totalEstimatedRows }),
                            onDone: {
                                target: 'persisting',
                                actions: assign({ metrics: ({ event }) => event.output }),
                            },
                            onError: {
                                target: 'error',
                                actions: assign(({ event }) => ({ unexpectedError: event.error.toString() })),
                            }
                        }
                    },
                    'handling-local-step': {
                        entry: () => {
                            this.logger.log('Handling local step...', 'info', 'handling-local-step', this.id);
                        },
                        invoke: {
                            id: 'handling-local-step',
                            src: 'handlingLocalStep',
                            input: ({ context }) => ({ activeStream: context.activeStream, layout: context.layout, totalEstimatedRows: context.totalEstimatedRows }),
                            onDone: {
                                target: 'persisting',
                                actions: assign({ metrics: ({ event }) => event.output }),
                            },
                            onError: {
                                target: 'error',
                                actions: assign(({ event }) => ({ unexpectedError: event.error.toString() })),
                            }
                        }
                    },
                    persisting: {
                        entry: () => {
                            this.logger.log('Persisting data...', 'info', 'persisting', this.id);
                        },
                        invoke: {
                            id: 'persisting',
                            src: 'persisting',
                            input: ({ context }) => ({ activeStream: context.activeStream }),
                            onDone: {
                                target: 'handle-global-steps',
                                actions: assign({ 
                                    metrics: ({ event }) => event.output,
                                    activeStream: () => null,
                                }),
                            },
                            onError: {
                                target: 'error',
                                actions: assign(({ event }) => ({ unexpectedError: event.error.toString() })),
                            }
                        }
                    },
                    'handle-global-steps': {
                        entry: () => {
                            this.logger.log('Handling global step...', 'info', 'handle-global-steps', this.id);
                        },
                        invoke: {
                            id: 'handle-global-steps',
                            src: 'handlingGlobalStep',
                            input: ({ context }) => ({ layout: context.layout }),
                            onDone: [
                                {
                                    target: 'initializing-user-view',
                                    actions: assign({ metrics: ({ event }) => event.output })
                                }
                            ],
                            onError: {
                                target: 'error',
                                actions: assign(({ event }) => ({ unexpectedError: event.error.toString() })),
                            }
                        }
                    },
                    'initializing-user-view': {
                        entry: [
                            () => this.logger.log('Initializing user view...', 'info', 'initializing-user-view', this.id),
                            assign({ activeStream: () => null }),
                        ],
                        initial: 'loading-rows',
                        states: {
                            'loading-rows': {
                                entry: () => {
                                    this.logger.log('Loading rows...', 'info', 'loading-rows', this.id);
                                },
                                invoke: {
                                    id: 'loading-rows',
                                    src: 'loadingRows',
                                    input: ({ context }) => ({ layout: context.layout, metrics: context.metrics }),
                                    onDone: {
                                        target: 'user-view-initialized',
                                        actions: assign({ 
                                            currentRows: ({ event }) => event.output.rows,
                                            currentErrors: ({ event }) => event.output.errors,
                                        })
                                    },
                                    onError: {
                                        target: '#ETL-error',
                                        actions: assign(({ event }) => ({ unexpectedError: event.error.toString() })),
                                    }
                                }
                            },
                            'user-view-initialized': {
                                type: 'final'
                            }
                        },
                        onDone: {
                            target: 'waiting-user'
                        }
                    },
                    'waiting-user': {
                        entry: () => {
                            this.logger.log('Waiting for user interaction...', 'info', 'waiting-user', this.id);
                        },
                        on: {
                            CHANGE_PAGE: {
                                target: 'initializing-user-view',
                                actions: assign({ pageNumber: ({ event }) => event.pageNumber })
                            },
                            EDIT_ROW: {
                                target: 'editing-row',
                                actions: assign({ editingRow: ({ event }) => event.rowEdition })
                            },
                            REMOVE_ROW: {
                                target: 'removing-row',
                                actions: assign({ removingRow: ({ event }) => ({ rowId: event.rowId }) })
                            },
                            EXPORT: {
                                target: 'exporting',
                                actions: assign({ exporting: ({ event }) => ({ id: event.id, target: event.target as 'Stream' | 'File'} )})
                            }
                        }
                    },
                    'editing-row': {
                        entry: () => {
                            this.logger.log('Editing row...', 'info', 'editing-row', this.id);
                        },
                        initial: 'editing-data',
                        states: {
                            'editing-data': {
                                entry: () => {
                                    this.logger.log('Editing data...', 'debug', 'editing-data', this.id);
                                },
                                invoke: {
                                    id: 'editing-data',
                                    src: 'editingData',
                                    input: ({ context }) => ({ rowEdition: context.editingRow }),
                                    onDone: {
                                        target: 'local-step-pipe',
                                    },
                                    onError: {
                                        target: '#ETL-error',
                                        actions: assign(({ event }) => ({ unexpectedError: event.error.toString() })),
                                    }
                                }
                            },
                            'local-step-pipe': {
                                entry: () => {
                                    this.logger.log('Local step pipe...', 'debug', 'local-step-pipe', this.id);
                                },
                                invoke: {
                                    id: 'local-step-pipe',
                                    src: 'localStepPipe',
                                    input: ({ context }) => ({ rowEdition: context.editingRow, activeStream: context.activeStream, layout: context.layout }),
                                    onDone: {
                                        target: 'persisting',
                                        actions: assign({ activeStream: ({ event }) => event.output }),
                                    },
                                    onError: {
                                        target: '#ETL-error',
                                        actions: assign(({ event }) => ({ unexpectedError: event.error.toString() })),
                                    }
                                }
                            },
                            persisting: {
                                entry: () => {
                                    this.logger.log('Persisting data...', 'info', 'persisting', this.id);
                                },
                                invoke: {
                                    id: 'persisting',
                                    src: 'persisting',
                                    input: ({ context }) => ({ activeStream: context.activeStream }),
                                    onDone: {
                                        target: 'global-step-pipe',
                                    },
                                    onError: {
                                        target: '#ETL-error',
                                        actions: assign(({ event }) => ({ unexpectedError: event.error.toString() })),
                                    }
                                }
                            },
                            'global-step-pipe': {
                                entry: () => {
                                    this.logger.log('Global step pipe...', 'debug', 'global-step-pipe', this.id);
                                },
                                invoke: {
                                    id: 'global-step-pipe',
                                    src: 'globalStepPipe',
                                    input: ({ context }) => ({ rowEdition: context.editingRow, layout: context.layout }),
                                    onDone: {
                                        target: 'cleaning',
                                    },
                                    onError: {
                                        target: '#ETL-error',
                                        actions: assign(({ event }) => ({ unexpectedError: event.error.toString() })),
                                    }
                                },
                            },
                            cleaning: {
                                entry: [
                                    () => this.logger.log('Cleaning data...', 'debug', 'cleaning', this.id),
                                    assign({ 
                                        editingRow: () => null,
                                        removingRow: () => null,
                                        exporting: () => null,
                                        activeStream: () => null,
                                        pageNumber: () => 1,
                                    }),
                                ],
                                type: 'final'
                            }
                        },
                        exit: assign({ editingRow: () => null }),
                        onDone: {
                            target: 'waiting-user'
                        }
                    },
                    'removing-row': {
                        entry: () => {
                            this.logger.log('Removing row...', 'info', 'removing-row', this.id);
                        },
                        invoke: {
                            id: 'removing-row',
                            src: 'removingRow',
                            input: ({ context }) => ({ removingRow: context.removingRow }),
                            onDone: {
                                target: 'initializing-user-view',
                            },
                            onError: {
                                target: 'error',
                                actions: assign(({ event }) => ({ unexpectedError: event.error.toString() })),
                            }
                        },
                    },
                    exporting: {
                        entry: () => {
                            this.logger.log('Exporting data...', 'info', 'exporting', this.id);
                        },
                        invoke: {
                            src: 'exporting',
                            input: ({ context }) => ({ exporting: context.exporting, layout: context.layout }),
                            onDone: {
                                target: 'waiting-user',
                            },
                            onError: {
                                target: 'error',
                                actions: assign(({ event }) => ({ unexpectedError: event.error.toString() }))
                            }
                        },
                    },
                    error: {
                        id: 'ETL-error',
                        entry: () => {
                            this.logger.log('Proccess failed...', 'error', 'error', this.id);
                        },
                        on: {
                            RESET: {
                                target: '#ETL-initializing',
                                actions: assign(DEFAULT_CONTEXT),
                            }
                        }
                    }

                },
                on: {
                    'RESET': {
                        target: '#ETL-initializing',
                        actions: assign(DEFAULT_CONTEXT),
                    }
                }
            } as const,
            {
                actors: {
                    importFile: fromPromise(async ({ input, signal }: any) => {
                        const importer = this.provider.modules.importer;
                        const progressSignal = importer.getProgress();
                        assign({progress: [...this.contextSubject.value.progress, {label: 'Importing file', value: progressSignal}]});
                        return importer.readFileStream(input.file, (rows) =>  assign({totalEstimatedRows: rows}), signal);
                    }),
                    mapping: fromPromise(async ({ input, signal }: any) => {
                        const mapper = this.provider.modules.mapper;
                        const progressSignal = mapper.getProgress();
                        assign({progress: [...this.contextSubject.value.progress, {label: 'Mapping', value: progressSignal}]});
                        return mapper.handleStream(input.activeStream, input.layout, (progress) => assign({progress: [...this.contextSubject.value.progress, progress]}), input.totalEstimatedRows, signal);
                    }),
                    handlingLocalStep: fromPromise(async ({ input, signal }: any) => {
                        const localStepEngine = this.provider.modules.localStepEngine;
                        return localStepEngine.handleStream(input.activeStream, input.layout, (progress) => assign({progress: [...this.contextSubject.value.progress, progress]}), input.totalEstimatedRows, signal);
                    }),
                    persisting: fromPromise(async ({ input, signal }: any) => {
                        const persistence = this.provider.modules.persistence;
                        return persistence.saveStream(input.activeStream, signal);
                    }),
                    handlingGlobalStep: fromPromise(async ({ input, signal }: any) => {
                        const globalStepEngine = this.provider.modules.globalStepEngine;
                        const persistence = this.provider.modules.persistence;

                        for (const step of input.layout.globalSteps) {
                            const stream = globalStepEngine.handleStep(step, persistence, signal);
                            let removedErrors: number[] = [];
                            const transformedStream = stream.pipeThrough(new TransformStream({
                                transform: async ({ rows, errors, removedErrors }: any, controller) => {
                                    removedErrors = removedErrors ?? [];
                                    controller.enqueue({ rawRows: rows, errorDicc: errors, metrics: null });
                                }
                            }));

                            await persistence.saveStream(transformedStream, signal);
                            if (removedErrors.length > 0) {
                                await persistence.deleteErrors(removedErrors);
                            }
                        }
                        await persistence.updateMetricsSaved();
                    }),
                    loadingRows: fromPromise(async ({ input, signal }: any) => {
                        const persistence = this.provider.modules.persistence;
                        const viewer = this.provider.modules.viewer;

                        const rowsData = await viewer.getRowsWithPagination(persistence, input.metrics, input.layout.filter, input.pageNumber ?? 1, signal);
                        return rowsData;

                    }),
                    editingData: fromPromise(async ({ input, signal }: any) => {
                        const editor = this.provider.modules.viewer;
                        const persistence = this.provider.modules.persistence;

                        await editor.editRow(persistence, input.rowEdition, signal);
                    }),
                    localStepPipe: fromPromise(async ({ input, signal }: any) => {
                        const localStepEngine = this.provider.modules.localStepEngine;
                        const persistence = this.provider.modules.persistence;

                        const stream = persistence.getRowsStream({ rowIdIn: [input.rowEdition.rowId] });
                        const resultStream = await localStepEngine.handleStream(stream, input.layout, signal);

                        return resultStream;
                    }),
                    globalStepPipe: fromPromise(async ({ input, signal }: any) => {
                        const globalStepEngine = this.provider.modules.globalStepEngine;
                        const persistence = this.provider.modules.persistence;
                        const rowEdition = input.rowEdition;
                        const layout: LayoutBase = input.layout;

                        for (const step of layout.globalSteps) {

                            let rowIds: number[] = step.reprocessAllRowsOnChange ? undefined : [parseInt(rowEdition.rowId)];
                            if (step.reprocessAllRowsOnChange) {
                                const stream = globalStepEngine.handleStep(step, persistence, signal, rowIds);
                                const resultStream = stream.pipeThrough(new TransformStream({
                                    transform: async ({ rows, errors, removedErrors }: any, controller) => {
                                        removedErrors = removedErrors ?? [];
                                        controller.enqueue({ rawRows: rows, errorDicc: errors, metrics: null });
                                    }
                                }));
                                await persistence.saveStream(resultStream, signal);
                            }
                        }

                        await persistence.updateMetricsSaved();
                    }),
                    removingRow: fromPromise(async ({ input, signal }: any) => {
                        const persistence = this.provider.modules.persistence;
                        await persistence.deleteRow(input.removingRow.rowId);
                        await persistence.updateMetricsSaved();
                    }),
                    exporting: fromPromise(async ({ input, signal }: any) => {
                        const exporter = this.provider.modules.exporter;
                        const persistence = this.provider.modules.persistence;                        

                        const exportingInput = input as {exporting: {id: string, target: 'Stream' | 'File', callback: (stream: ReadableStream) => Promise<void>}, layout: LayoutBase};
                        const exportKey = exportingInput.exporting.id;
                        const exportObj = input.layout.exports[exportKey] as {fn: (row: RowObject) => any, labelDicc?: Record<string, string>, callback?: (stream: ReadableStream) => Promise<void>};
                        
                        if (!exportObj?.fn) {
                            throw new Error(`Export function not found for key: ${exportKey}`);
                        }

                        const stream = persistence.getRowsStream({});

                        const resultStream = await exporter.exportStream(stream,exportObj.fn,signal);
                        if(exportingInput.exporting.target === 'Stream') {
                            await exportObj.callback?.(resultStream);
                        } else {
                            const metrics = await persistence.getMetrics();
                            await exporter.exportToCsv(resultStream, metrics.totalRows, metrics.fileName + '_' + new Date().toISOString() + '.csv', exportObj.labelDicc)
                        }

                    })


                }
            }
        ) as ReturnType<typeof createMachine>;

        this.context$ = this.contextSubject.asObservable();
        this.state$ = this.stateSubject.asObservable();
        this.metrics$ = this.metricsSubject.asObservable();

        this.logger.log('Orchestrator started', 'info', 'start', this.id);
    }

    public cleanPersistence = () => {
        if (!this.actor)
            return;

        this.provider.modules.persistence.clear();
    }

    private start = () => {
        if (this.actor) {
            this.logger.log('Orchestrator already started', 'error', 'start', this.id);
            return;
        }

        this.actor = createActor(this.machine!);

        this.actorSubscription = this.actor.subscribe((snapshot) => {
            const { value, context } = snapshot;

            this.stateSubject.next(value as OrchestatorStateType);
            this.contextSubject.next(context as OrchestatorContext);
            this.metricsSubject.next(context.metrics);

            this.stateSignal.value = value as OrchestatorStateType;
            this.metricsSignal.value = context.metrics;

        });

        this.actor.start();
    }

    public stop = () => {
        if (!this.actor)
            return;

        this.logger.log('Orchestrator stopping...', 'info', 'stop', this.id);

        this.actor.stop();
        this.actorSubscription?.unsubscribe();

        this.contextSubject.complete();
        this.stateSubject.complete();
        this.metricsSubject.complete();
        this.cleanPersistence();

        this.logger.log('Orchestrator stopped', 'info', 'stop', this.id);
    }

    public selectFile = (file: File) => {
        this.actor?.send({ type: 'FILE_SELECTED', file });
    }

    public selectLayout = (layout: LayoutBase) => {
        this.actor?.send({ type: 'LAYOUT_SELECTED', layout });
    }

    public changePage = (pageNumber: number) => {
        this.actor?.send({ type: 'CHANGE_PAGE', pageNumber });
    }

    public removeRow = (rowId: number) => {
        this.actor?.send({ type: 'REMOVE_ROW', rowId });
    }

    public export = (id: string, target: 'Stream' | 'File') => {
        this.actor?.send({ type: 'EXPORT', id, target });
    }

    public reset = () => {
        this.actor?.send({ type: 'RESET' });
    }

    public editRow = (rowId: number, key: string, value: string) => {
        this.actor?.send({ type: 'EDIT_ROW', rowEdition: { rowId, key, value } });
    }


}

