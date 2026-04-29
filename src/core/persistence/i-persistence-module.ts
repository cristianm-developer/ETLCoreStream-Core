import { ValidationError } from "@/shared/schemes/local-step-validators";
import { RowFilter } from "@/shared/schemes/persistent-filter";
import { RowObject } from "@/shared/schemes/row-object";
import { FileMetrics } from "@/shared/schemes/file-metrics";

export type PersistenceModuleOptions = {
    chunkSizeQtd?: number;
    dbName: string;
    storeNames: {
        rows: string;
        errors: string;
        metrics: string;
    }
    storeKeys: {
        rows: string;
        errors: string;
        metrics: string;
    }
}

export const DEFAULT_PERSISTENCE_MODULE_OPTIONS: PersistenceModuleOptions = {
    chunkSizeQtd: 100,
    dbName: 'importer-db',
    storeNames: {
        rows: 'rows',
        errors: 'errors',
        metrics: 'metrics'
    },
    storeKeys: {
        rows: '__rowId',
        errors: '__rowId',
        metrics: 'id'
    }
}

export interface IPersistenceModule {
    id: 'persistence-indexdb';
    
    saveStream: (stream: ReadableStream<{rawRows: RowObject[], errorDicc: Record<number, ValidationError>, metrics?: any}>, signal?: AbortSignal) => Promise<void>;
    getRowsStream: (filter: RowFilter) => ReadableStream<{rows: RowObject[]}>;
    getErrorsStream: (filter: RowFilter) => ReadableStream<{errors: ValidationError[]}>;
    clear: () => Promise<void>;

    getRowById: (id: number) => Promise<RowObject | undefined>;
    getErrorById: (id: number) => Promise<ValidationError | undefined>;
    
    updateRow: (row: RowObject) => Promise<void>;
    deleteRow: (id: number) => Promise<void>;
    deleteErrors: (ids: number[]) => Promise<void>;

    saveMetrics: (metrics: FileMetrics) => Promise<void>;
    updateMetrics: (metrics: FileMetrics) => Promise<void>;
    updateMetricsSaved: () => Promise<void>;
    getMetrics: () => Promise<FileMetrics | undefined>;
}