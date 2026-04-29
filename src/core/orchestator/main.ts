import { LayoutBase } from "@/shared/schemes/layout-base";
import { ILoggerModule } from "../logger/i-logger-module";
import { ProviderModule } from "../provider/main";
import { OrchestatorContext } from "./schemes/orchestator-context";
import { BehaviorSubject, Observable } from "rxjs";
import { OrchestatorStateType } from "./schemes/orchestator-states";
import { Log } from "@/shared/schemes/log";
import { ActorRefFrom, assign, createActor, createMachine, emit, fromPromise, setup, Subscription } from "xstate";
import { Signal, signal } from "@preact/signals-core";
import { OrchestatorEvent } from "./schemes/orchestator-event";
import { RowObject } from "@/shared/schemes/row-object";


const DEFAULT_CONTEXT: OrchestatorContext = {
    file: null,
    layout: null,
    metrics: undefined,
    progress: [],
    activeStream: null,
    unexpectedError: null,
    editingRow: null,
    removingRow: null,
    exporting: null,
    currentRowsFilter: null,
    currentRows: null,
    currentErrors: null,
    currentPage: 1,
    totalPages: 0,
    totalEstimatedRows: 0,
    processingRows: false,
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

    private progressSubject: BehaviorSubject<{label: string, value: number|null}[]> = new BehaviorSubject<{label: string, value: number|null}[]>(DEFAULT_CONTEXT.progress);
    readonly progress$: Observable<{label: string, value: number|null}[]> = this.progressSubject.asObservable();

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
                        "mapping": { output: undefined };
                        "handling-local-step": { output: undefined };
                        "persisting": { output: undefined };
                        "handle-global-steps": { output: undefined };
                        "loading-rows": { output: undefined };
                        "editing-data": { output: undefined };
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
                        entry: [
                            () => this.logger.log('Orchestrator initializing...', 'info', 'initializing', this.id),
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
                        entry: [
                            () => this.logger.log('Importing file...', 'info', 'importing', this.id),
                            assign({ processingRows: true })
                        ],
                        invoke: {
                            id: 'import-file',
                            src: 'importFile',
                            input: ({ context }) => ({ file: context.file }),
                            onDone: {
                                target: 'mapping',
                                actions: assign( ({ event }) => ({activeStream: event.output.stream, totalEstimatedRows: event.output.totalRowsEstimated }))
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
                            input: ({ context }) => ({ activeStream: context.activeStream, totalEstimatedRows: context.totalEstimatedRows }),
                            onError: {
                                target: 'error',
                                actions: assign(({ event }) => ({ unexpectedError: event.error.toString() })),
                            },                            
                        },
                        on: {
                            FIRST_CHUNK_RAW_READY: {
                                target: 'handle-global-steps',
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
                            input: ({ context }) => ({ layout: context.layout, totalEstimatedRows: context.totalEstimatedRows }),
                            onDone: [
                                {
                                    target: 'initializing-user-view',
                                }
                            ],
                            onError: {
                                target: 'error',
                                actions: assign(({ event }) => ({ unexpectedError: event.error.toString() })),
                            }
                        },
                        on: {
                            FIRST_CHUNK_PROCESSED_READY: {
                                target: 'initializing-user-view',
                            },
                            ALL_CHUNKS_PROCESSED: {
                                target: 'initializing-user-view',
                            }
                        }
                    },
                    'initializing-user-view': {
                        entry: [
                            () => this.logger.log('Initializing user view...', 'info', 'initializing-user-view', this.id),
                        ],
                        initial: 'loading-rows',
                        states: {
                            'loading-metrics': {
                                entry: () => {
                                    this.logger.log('Loading metrics...', 'info', 'loading-metrics', this.id);
                                },
                                invoke: {
                                    id: 'loading-metrics',
                                    src: 'loadingMetrics',
                                    input: ({ context }) => ({ layout: context.layout }),
                                    onDone: {
                                        actions: assign({ metrics: ({ event }) => event.output.metrics, totalPages: ({ event }) => event.output.totalPages })
                                    }
                                }
                            },
                            'loading-rows': {
                                entry: () => {
                                    this.logger.log('Loading rows...', 'info', 'loading-rows', this.id);
                                },
                                invoke: {
                                    id: 'loading-rows',
                                    src: 'loadingRows',
                                    input: ({ context }) => ({ layout: context.layout, metrics: context.metrics, pageNumber: context.currentPage }),
                                    onDone: {
                                        target: 'user-view-initialized',                 
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
                    'waiting-final-processing': {
                        entry: () => {
                            this.logger.log('Waiting for final processing...', 'info', 'waiting-final-processing', this.id);
                        },
                        always: {
                            target: 'waiting-user',
                            guard: ({ context }) => context.processingRows === false,
                        },
                        on: {
                            CHANGE_PAGE: {
                                target: 'initializing-user-view',
                                actions: assign({ currentPage: ({ event }) => event.pageNumber })
                            },
                            FINAL_PROCESSING_READY: {
                                target: 'waiting-user',
                                actions: assign({ processingRows: false })
                            }
                        }
                        
                    },
                    'waiting-user': {
                        entry: [
                            () => this.logger.log('Waiting for user interaction...', 'info', 'waiting-user', this.id),
                            assign({ processingRows: false, progress: [] })
                        ],
                        on: {
                            CHANGE_PAGE: {
                                target: 'initializing-user-view',
                                actions: assign({ currentPage: ({ event }) => event.pageNumber })
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
                        entry: [
                            () => this.logger.log('Editing row...', 'info', 'editing-row', this.id),
                            assign({ processingRows: true })
                        ],
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
                                        actions: assign({ activeStream: null }),
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
                                        actions: assign({ processingRows: false })
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
                                        activeStream: () => null
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
                        entry: [
                            () => this.logger.log('Removing row...', 'info', 'removing-row', this.id),
                            assign({ processingRows: true })
                        ],
                        invoke: {
                            id: 'removing-row',
                            src: 'removingRow',
                            input: ({ context }) => ({ removingRow: context.removingRow }),
                            onDone: {
                                target: 'initializing-user-view',
                                actions: assign({ processingRows: false })
                            },
                            onError: {
                                target: 'error',
                                actions: assign(({ event }) => ({ unexpectedError: event.error.toString() })),
                            }
                        },
                        exit: assign({ removingRow: () => null }),
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
                        exit: assign({ exporting: () => null }),
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
                        target: '.initializing',
                        actions: assign(DEFAULT_CONTEXT),
                    }
                }
            } as const,
            {
                actors: {
                    importFile: fromPromise(async ({ input, signal }: any) => {
                        const importer = this.provider.modules.importer;
                        const [stream, totalRowsEstimated] = importer.readFileStream(input.file, signal);
                        return { stream, totalRowsEstimated };
                    }),
                    mapping: fromPromise(async ({ input, signal }: any) => {
                        const mapper = this.provider.modules.mapper;
                        return mapper.handleStream(input.activeStream, input.layout, input.totalEstimatedRows, signal);
                    }),
                    handlingLocalStep: fromPromise(async ({ input, signal }: any) => {
                        const localStepEngine = this.provider.modules.localStepEngine;
                        return localStepEngine.handleStream(input.activeStream, input.layout, input.totalEstimatedRows, signal);
                    }),
                    persisting: fromPromise(async ({ input, emit, signal }: any) => {
                        const persistence = this.provider.modules.persistence;
                        persistence.saveStream(input.activeStream, input.totalEstimatedRows, () => emit({ type: 'FIRST_CHUNK_RAW_READY' }) , signal);
                    }),
                    handlingGlobalStep: fromPromise(async ({ input, signal, emit }: any) => {
                        const globalStepEngine = this.provider.modules.globalStepEngine;
                        const persistence = this.provider.modules.persistence;
                                                                                
                        for (const step of input.layout.globalSteps) {
                            let removedErrorsAcc: number[] = [];
                            const filter = step.filter.rows;
                            const streamInput = persistence.getRowsStream(filter);
                                                        
                            const streamResult = globalStepEngine.handleStep(streamInput, step, null, signal);                            
                            const transformedStream = streamResult.pipeThrough(new TransformStream({
                                transform: async ({ rows, errors, removedErrors }: any, controller) => {
                                    removedErrorsAcc.push(...(removedErrors ?? []));
                                    controller.enqueue({ rawRows: rows, errorDicc: errors });
                                }
                            }));

                            persistence.saveStream(transformedStream, null, () => emit({ type: 'FIRST_CHUNK_PROCESSED_READY' }), signal)
                            .then(() => emit({ type: 'ALL_CHUNKS_PROCESSED' }));
                            if (removedErrorsAcc.length > 0) {
                                persistence.deleteErrors(removedErrorsAcc);
                            }
                        }

                    }),
                    loadingMetrics: fromPromise(async ({ input, signal }: any) => {
                        const persistence = this.provider.modules.persistence;
                        const viewer = this.provider.modules.viewer;
                        
                        await persistence.updateMetrics();
                        const metrics = await persistence.getMetrics();

                        const totalPages = viewer.getTotalPages(metrics.totalRows);
                        return { metrics, totalPages };
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
                        const resultStream = await localStepEngine.handleStream(stream, input.layout, 1, signal);
                        
                        return resultStream;
                    }),
                    globalStepPipe: fromPromise(async ({ input, signal }: any) => {

                        const globalStepEngine = this.provider.modules.globalStepEngine;
                        const persistence = this.provider.modules.persistence;
                        const rowEdition = input.rowEdition;
                        const layout: LayoutBase = input.layout;

                        for (const step of layout.globalSteps) {
                            let removedErrorsAcc: number[] = [];
                            let rowIds: number[] = step.reprocessAllRowsOnChange ? undefined : [parseInt(rowEdition.rowId)];
                            const stream = persistence.getRowsStream({ ...step.filter.rows, rowIdIn: rowIds });
                            
                            const resultStream = globalStepEngine.handleStep(stream, step, null, signal);
                            const parsedStream = resultStream.pipeThrough(new TransformStream({
                                transform: async ({ rows, errors, removedErrors }: any, controller) => {
                                    removedErrorsAcc.push(...(removedErrors ?? []));
                                    controller.enqueue({ rawRows: rows, errorDicc: errors });
                                }
                            }));

                            await persistence.saveStream(parsedStream, null, null, signal);
                            if (removedErrorsAcc.length > 0) {
                                persistence.deleteErrors(removedErrorsAcc);
                            }
                        }

                    }),
                    removingRow: fromPromise(async ({ input, signal }: any) => {
                        const persistence = this.provider.modules.persistence;
                        await persistence.deleteRow(input.removingRow.rowId);
                        await persistence.updateMetrics();

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
            this.progressSubject.next(context.progress.filter(e => e.value !== null));

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

