import { OrchestatorContext } from './schemes/orchestator-context';
import { OrchestatorStateType } from './schemes/orchestator-states';
import { LayoutBase } from '@/shared/schemes/layout-base';
import { Log } from '@/shared/schemes/log';
import { Observable } from 'rxjs';
import { ProviderModule } from '../provider/main';


export interface IOrchestatorModule {

    initialize(provider: ProviderModule, id?: string): void;

    setLayout: (layout: LayoutBase) => void;
    getLayout: () => LayoutBase | null;

    getId(): string;
    getCurrentState(): OrchestatorStateType;
    getCurrentContext(): OrchestatorContext;

    getProgress$(): Observable<{label: string, value: number|null}[]>

    getStateObservable(): Observable<OrchestatorStateType>;
    getContextObservable(): Observable<OrchestatorContext>;
    getMetricsObservable(): Observable<OrchestatorContext['metrics']>;
    getLogsObservable(): Observable<Log>;

    start(): void;
    stop(): void;
    reset(): void;

    executeImportStep(): void;
    executeMappingStep(): void;
    executeLocalStepsEngine(): void;
    executeGlobalStepsEngine(): void;
    executePersistenceStep(): void;
    executeCleanup(): void;
    
    uploadFile(file: File): void;
    getFile(): File | null;

    getProgress(): number;
    getLogs(): Log[];

    getRows(): void;
    editRow(): void;
    removeRow(): void;

    exportToFile(): void;
    exportToStream(): void;
    
}
