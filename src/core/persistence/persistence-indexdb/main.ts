import { LoggerModule } from "@/core/logger/logger-native/main";
import { DEFAULT_PERSISTENCE_MODULE_OPTIONS, IPersistenceModule, PersistenceModuleOptions } from "../i-persistence-module";
import { ErrorFilter, RowFilter } from "@/shared/schemes/persistent-filter";
import { RowObject } from "@/shared/schemes/row-object";
import { ValidationError } from "@/shared/schemes/local-step-validators";
import { FileMetrics } from "@/shared/schemes/file-metrics";



export class PersistenceIndexDbModule implements IPersistenceModule {
    public id: 'persistence-indexdb';
    private logger: LoggerModule;
    private options: PersistenceModuleOptions;

    private db: IDBDatabase | null = null;
    private maxStorageBytes: number = 50 * 1024 * 1024;

    constructor(logger: LoggerModule, options: PersistenceModuleOptions) {
        this.logger = logger;
        this.options = { ...DEFAULT_PERSISTENCE_MODULE_OPTIONS, ...options };
        this.logger.log('PersistenceIndexDbModule initialized', 'debug', 'constructor', this.id);

        this.getRowsStream = this.getRowsStream.bind(this);
        this.getErrorsStream = this.getErrorsStream.bind(this);
    }


    private initDb: () => Promise<IDBDatabase> = async () => {
        if (this.db) {
            const isAlive = await this.isConnectionAlive();
            if (isAlive) return this.db;
            this.logger.log('Database connection is zombie, forcing reconnection', 'warn', 'initDb', this.id);
            this.db = null;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.options.dbName!, 1);

            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(this.options.storeNames.rows)) {
                    db.createObjectStore(this.options.storeNames.rows, { keyPath: this.options.storeKeys.rows });
                }
                if (!db.objectStoreNames.contains(this.options.storeNames.errors)) {
                    db.createObjectStore(this.options.storeNames.errors, { keyPath: this.options.storeKeys.errors });
                }
                if (!db.objectStoreNames.contains(this.options.storeNames.metrics)) {
                    db.createObjectStore(this.options.storeNames.metrics, { keyPath: this.options.storeKeys.metrics });
                }
            };

            request.onsuccess = () => {
                this.db = request.result;

                this.db.onclose = () => {
                    this.logger.log('Database connection closed unexpectedly', 'warn', 'initDb', this.id);
                    this.db = null;
                };

                this.db.onversionchange = () => {
                    this.logger.log('Database version changed in another tab, closing connection', 'warn', 'initDb', this.id);
                    this.db?.close();
                    this.db = null;
                };

                resolve(this.db);
            };

            request.onerror = () => {
                reject(new Error('Failed to open database: ' + request.error?.message));
            };
        });
    };

    private isConnectionAlive = async (): Promise<boolean> => {
        if (!this.db) return false;
        try {
            this.db.transaction([], 'readonly');
            return true;
        } catch {
            return false;
        }
    };

    private executeTransaction = async (mode: IDBTransactionMode, actions: { storeName: string, fn: (store: IDBObjectStore) => void }[]) => {
        let attempts = 0;
        const maxAttempts = 2;

        while (attempts < maxAttempts) {
            try {
                const db = await this.initDb();
                const storeNames = actions.map(action => action.storeName);

                return await new Promise((resolve, reject) => {
                    const transaction = db.transaction(storeNames, mode);

                    try {
                        for (const action of actions) {
                            const store = transaction.objectStore(action.storeName);
                            action.fn(store);
                        }
                        if (typeof transaction.commit === 'function') {
                            transaction.commit();
                        }
                    } catch (error) {
                        transaction.abort();
                        return reject(error);
                    }

                    transaction.oncomplete = () => {
                        resolve(true);
                    };

                    transaction.onerror = () => {
                        const error = transaction.error;
                        if (error?.name === 'QuotaExceededError') {
                            this.logger.log('Storage quota exceeded. Consider cleaning old data.', 'error', 'executeTransaction', this.id);
                        }
                        const errorMsg = error?.message || 'Transaction failed';
                        this.logger.log('Transaction failed: ' + errorMsg, 'error', 'executeTransaction', this.id);
                        reject(new Error('Transaction failed: ' + errorMsg));
                    };
                });
            } catch (error) {
                attempts++;
                this.db = null;
                if (attempts >= maxAttempts) {
                    this.logger.log(`Transaction failed after ${maxAttempts} attempts`, 'error', 'executeTransaction', this.id);
                    throw error;
                }
                this.logger.log(`Retrying transaction... (attempt ${attempts}/${maxAttempts})`, 'warn', 'executeTransaction', this.id);
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
    };


    getRowsStream(filter: RowFilter): ReadableStream<{ rows: RowObject[] }> {
        const batchSize = this.options.chunkSizeQtd || 100;
        let lastRowId: number | null = null;
        let isFinished = false;

        const self = this;

        return new ReadableStream({
            async pull(controller) {
                if (isFinished) {
                    controller.close();
                    return;
                }

                try {
                    const db = await self.initDb();
                    const transaction = db.transaction(self.options.storeNames.rows, 'readonly');
                    const store = transaction.objectStore(self.options.storeNames.rows);

                    let range: IDBKeyRange | null = null;
                    if (lastRowId !== null) {
                        range = IDBKeyRange.lowerBound(lastRowId, true);
                    } else if (filter.fromRowId && filter.toRowId) {
                        range = IDBKeyRange.bound(filter.fromRowId, filter.toRowId);
                    } else if (filter.fromRowId) {
                        range = IDBKeyRange.lowerBound(filter.fromRowId);
                    } else if (filter.toRowId) {
                        range = IDBKeyRange.upperBound(filter.toRowId);
                    }

                    const batchRows: RowObject[] = [];
                    const cursorRequest = store.openCursor(range);

                    await new Promise<void>((resolve, reject) => {
                        cursorRequest.onsuccess = () => {
                            const cursor = cursorRequest.result;
                            if (!cursor) {
                                isFinished = true;
                                resolve();
                                return;
                            }

                            const row = cursor.value;
                            if (self.rowMatchesFilter(row, filter)) {
                                batchRows.push(row);
                                lastRowId = row[self.options.storeKeys.rows] as number;
                            }

                            if (batchRows.length < batchSize) {
                                cursor.continue();
                            } else {
                                resolve();
                            }
                        };

                        cursorRequest.onerror = () => {
                            reject(cursorRequest.error);
                        };
                    });

                    if (batchRows.length > 0) {
                        controller.enqueue({ rows: batchRows });
                    } else if (isFinished) {
                        controller.close();
                    }
                } catch (error) {
                    controller.error(error);
                }
            }
        });
    }


    private rowMatchesFilter = (row: RowObject, filter: RowFilter) => {

        if (filter.withErrors == true && !row.__sError) return false;
        if (filter.withoutErrors == true && row.__sError) return false;

        if (filter.fields?.length > 0) {
            for (const fieldFilter of filter.fields) {
                const rowValue = row.value?.[fieldFilter.headerKey];
                if (!this.evaluateOperator(rowValue, fieldFilter.operator, fieldFilter.value)) return false;
            }

        }

        return true;

    }

    private evaluateOperator = (rowValue: any, operator: string, filterValue: any) => {
        switch (operator) {
            case '=': return rowValue === filterValue;
            case '!=': return rowValue !== filterValue;
            case '>': return rowValue > filterValue;
            case '<': return rowValue < filterValue;
            case '>=': return rowValue >= filterValue;
            case '<=': return rowValue <= filterValue;
            case 'includes': {
                const rowValStr = (rowValue ?? "").toString();
                const filterValStr = (filterValue ?? "").toString();
                return rowValStr.includes(filterValStr);
            }
            case 'notIncludes': {
                const rowValStr = (rowValue ?? "").toString();
                const filterValStr = (filterValue ?? "").toString();
                return !rowValStr.includes(filterValStr);
            }
            case 'startsWith': {
                const rowValStr = (rowValue ?? "").toString();
                const filterValStr = (filterValue ?? "").toString();
                return rowValStr.startsWith(filterValStr);
            }
            case 'endsWith': {
                const rowValStr = (rowValue ?? "").toString();
                const filterValStr = (filterValue ?? "").toString();
                return rowValStr.endsWith(filterValStr);
            }
            case 'isEmpty': return rowValue === null || rowValue === undefined || rowValue === '';
            case 'isNotEmpty': return rowValue !== null && rowValue !== undefined && rowValue !== '';
            case 'regex': {
                const rowValStr = (rowValue ?? "").toString();
                const filterValStr = (filterValue ?? "").toString();
                return new RegExp(filterValStr).test(rowValStr);
            }
            case 'notRegex': {
                const rowValStr = (rowValue ?? "").toString();
                const filterValStr = (filterValue ?? "").toString();
                return !new RegExp(filterValStr).test(rowValStr);
            }
            case 'isTrue': return rowValue === true;
            case 'isFalse': return rowValue === false;
            case 'isNotNull': return rowValue !== null;
            case 'isNullish': return rowValue === null || rowValue === undefined;
            case 'isDefined': return rowValue !== undefined;
            case 'isNumber': return typeof rowValue === 'number';
            default: return false;
        }
    }

    getErrorsStream(filter: ErrorFilter): ReadableStream<{ errors: ValidationError[] }> {
        const batchSize = this.options.chunkSizeQtd || 100;
        let lastRowId: number | null = null;
        let isFinished = false;

        const self = this;

        return new ReadableStream({
            async pull(controller) {
                if (isFinished) {
                    controller.close();
                    return;
                }

                try {
                    const db = await self.initDb();
                    const transaction = db.transaction(self.options.storeNames.errors, 'readonly');
                    const store = transaction.objectStore(self.options.storeNames.errors);

                    let range: IDBKeyRange | null = null;
                    if (lastRowId !== null) {
                        range = IDBKeyRange.lowerBound(lastRowId, true);
                    } else if (filter.fromRowId && filter.toRowId) {
                        range = IDBKeyRange.bound(filter.fromRowId, filter.toRowId);
                    } else if (filter.fromRowId) {
                        range = IDBKeyRange.lowerBound(filter.fromRowId);
                    } else if (filter.toRowId) {
                        range = IDBKeyRange.upperBound(filter.toRowId);
                    }

                    const batchErrors: ValidationError[] = [];
                    const cursorRequest = store.openCursor(range);

                    await new Promise<void>((resolve, reject) => {
                        cursorRequest.onsuccess = () => {
                            const cursor = cursorRequest.result;
                            if (!cursor) {
                                isFinished = true;
                                resolve();
                                return;
                            }

                            batchErrors.push(cursor.value.error);
                            lastRowId = cursor.key as number;

                            if (batchErrors.length < batchSize) {
                                cursor.continue();
                            } else {
                                resolve();
                            }
                        };

                        cursorRequest.onerror = () => {
                            reject(cursorRequest.error);
                        };
                    });

                    if (batchErrors.length > 0) {
                        controller.enqueue({ errors: batchErrors });
                    } else if (isFinished) {
                        controller.close();
                    }
                } catch (error) {
                    controller.error(error);
                }
            }
        });
    }

    getErrorById = async (id: number) => {
        const db = await this.initDb();
        const transaction = db.transaction(this.options.storeNames.errors, 'readonly');
        const store = transaction.objectStore(this.options.storeNames.errors);

        const result = await store.get(id);
        return result.result ?? undefined;
    }


    saveStream = async (stream: ReadableStream<{ rawRows: RowObject[], errorDicc: Record<number, ValidationError>, metrics?: any }>, signal?: AbortSignal) => {
        await this.initDb();

        const currentMetrics: FileMetrics = (await this.getMetrics()) ?? { id: '1', fileName: '1', fileSize: 0, totalRows: 0, totalErrorRows: 0, createdAt: 0, namefile: '' };

        let metricExist = false;
        const writable = new WritableStream({
            write: async (chunk, controller) => {
                signal?.throwIfAborted();
                const { rawRows, errorDicc, metrics } = chunk;
                const rows = rawRows as RowObject[];
                if (!rows || !Array.isArray(rows)) return;

                try {
                    await this.executeTransaction('readwrite', [
                        {
                            storeName: this.options.storeNames.rows,
                            fn: (store) => {
                                rows.forEach(r => store.put(r));
                            }
                        },
                        {
                            storeName: this.options.storeNames.errors,
                            fn: (store) => {
                                Object.entries(errorDicc).forEach(([rowId, error]) => {
                                    store.put({ [this.options.storeKeys.errors]: rowId, error });
                                });
                            }
                        }
                    ]);
                    this.logger.log(`Processed ${rows.length} rows successfully`, 'debug', 'saveStream', this.id);

                    if (metrics) {
                        metricExist = true;

                        currentMetrics.totalRows = metrics.totalRows;
                        currentMetrics.totalErrorRows = metrics.totalErrorRows;
                        currentMetrics.namefile = metrics.fileName;
                        currentMetrics.fileSize = metrics.fileSize;
                        currentMetrics.createdAt = metrics.createdAt;

                        await this.updateMetrics(currentMetrics);
                    } 

                } catch (error) {
                    this.logger.log(`Error saving stream chunk: ${error instanceof Error ? error.message : String(error)}`, 'error', 'saveStream', this.id);
                    throw error;
                }
            },
            close: async () => {
                this.logger.log('Writable stream closed', 'debug', 'saveStream', this.id);
                if(!metricExist){
                    await this.updateMetricsSaved();
                }
            },
            abort: (reason) => {
                this.logger.log(`Writable stream aborted: ${reason}`, 'warn', 'saveStream', this.id);
            }
        });

        try {
            await stream.pipeTo(writable);
            this.logger.log('Stream processing completed successfully', 'debug', 'saveStream', this.id);
        } catch (error) {
            this.logger.log(`Stream pipeline failed: ${error instanceof Error ? error.message : String(error)}`, 'error', 'saveStream', this.id);
            throw error;
        }
    };


    clear: () => Promise<void> = async () => {
        await this.executeTransaction('readwrite', [
            {
                storeName: this.options.storeNames.rows,
                fn: (store) => {
                    store.clear();
                }
            },
            {
                storeName: this.options.storeNames.errors,
                fn: (store) => {
                    store.clear();
                }
            },
            {
                storeName: this.options.storeNames.metrics,
                fn: (store) => {
                    store.clear();
                }
            }
        ])
    }

    getRowById: (id: number) => Promise<RowObject | undefined> = async (id: number) => {
        const db = await this.initDb();
        const transaction = db.transaction(this.options.storeNames.rows, 'readonly');
        
        const storeRows = transaction.objectStore(this.options.storeNames.rows);
        const storeErrors = transaction.objectStore(this.options.storeNames.errors);
                
        const result = await storeRows.get(id);
        const row = result.result ?? undefined;

        return row;
    }

    updateRow: (row: RowObject) => Promise<void> = async (row: RowObject) => {
        await this.executeTransaction('readwrite', [
            {
                storeName: this.options.storeNames.rows,
                fn: (store) => {
                    store.put(row);
                }
            }
        ]);
        const error = this.getErrorById(row.__rowId);
        if(error){
            this.deleteErrors([row.__rowId]);
        }

    }

    deleteRow: (id: number) => Promise<void> = async (id: number) => {
        await this.executeTransaction('readwrite', [
            {
                storeName: this.options.storeNames.rows,
                fn: (store) => {
                    store.delete(id);
                }
            }
        ])
        const currentMetrics: FileMetrics = (await this.getMetrics()) ?? { id: '1', fileName: '1', fileSize: 0, totalRows: 0, totalErrorRows: 0, createdAt: 0, namefile: '' };
        currentMetrics.totalErrorRows -= 1;

        const currentError: ValidationError | undefined = (await this.getErrorById(id)) ?? undefined;
        if (currentError) {
            await this.executeTransaction('readwrite', [
                {
                    storeName: this.options.storeNames.errors,
                    fn: (store) => {
                        store.delete(id);
                    }
                }
            ])

            currentMetrics.totalErrorRows -= 1;
        }
    }

    deleteErrors: (ids: number[]) => Promise<void> = async (ids: number[]) => {
        await this.executeTransaction('readwrite', [
            {
                storeName: this.options.storeNames.errors,
                fn: (store) => {
                    ids.forEach(id => store.delete(id));
                }
            }
        ])
    }

    saveMetrics: (metrics: FileMetrics) => Promise<void> = async (metrics: FileMetrics) => {
        await this.executeTransaction('readwrite', [
            {
                storeName: this.options.storeNames.metrics,
                fn: (store) => {
                    store.put(metrics);
                }
            }
        ]);
        this.logger.log(`Metrics saved for file ${metrics.fileName}`, 'debug', 'saveMetrics', this.id);
    }

    updateMetricsSaved: () => Promise<void> = async () => {
        
        const metrics = await this.getMetrics();
        await this.executeTransaction('readonly', [
            {
                storeName: this.options.storeNames.rows,
                fn: (store) => {
                    const request = store.getAll();
                    request.onsuccess = () => {
                        const allRows = request.result;
                        const totalRows = allRows.length;
                        const totalErrorRows = allRows.filter((row: any) => row.__sError).length;            

                        metrics.totalRows = totalRows;
                        metrics.totalErrorRows = totalErrorRows;
                    };
                }
            }
        ]);
        
        await this.executeTransaction('readwrite', [
            {
                storeName: this.options.storeNames.metrics,
                fn: (store) => {
                    store.put(metrics);
                }
            }
        ]);
    }

    updateMetrics: (metrics: FileMetrics) => Promise<void> = async (metrics: FileMetrics) => {
        await this.executeTransaction('readwrite', [
            {
                storeName: this.options.storeNames.metrics,
                fn: (store) => {
                    store.put(metrics);
                }
            }
        ]);
        this.logger.log(`Metrics updated for file ${metrics.fileName}`, 'debug', 'updateMetrics', this.id);
    }

    getMetrics: () => Promise<FileMetrics | undefined> = async () => {
        const db = await this.initDb();
        const transaction = db.transaction(this.options.storeNames.metrics, 'readonly');
        const store = transaction.objectStore(this.options.storeNames.metrics);

        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                resolve(request.result[0]);
            };
            request.onerror = () => {
                reject(request.error);
            };
        });
    }


}