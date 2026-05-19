import type { LoggerModule } from "@/core/logger/logger-native/main";
import type { IPersistenceModule, PersistenceModuleOptions } from "../i-persistence-module";
import { DEFAULT_PERSISTENCE_MODULE_OPTIONS } from "../i-persistence-module";
import type { ErrorFilter, RowFilter } from "@/shared/schemes/persistent-filter";
import type { RowObject } from "@/shared/schemes/row-object";
import type { ValidationError } from "@/shared/schemes/local-step-validators";
import type { FileMetrics } from "@/shared/schemes/file-metrics";
import type { Signal } from "@preact/signals-core";
import { signal } from "@preact/signals-core";
import { isEqual } from "lodash-es";
import type { GetRowsPaginatedOptions } from "@/shared/schemes/view-pagination";
import type { RecoverPoint } from "@/shared/schemes/recover-point";

export class PersistenceIndexDbModule implements IPersistenceModule {
  public id = "persistence-indexdb" as const;
  private logger: LoggerModule;
  private options: PersistenceModuleOptions;

  private db: IDBDatabase | null = null;

  progress = signal<number | null>(null);

  constructor(logger: LoggerModule, options: PersistenceModuleOptions) {
    this.logger = logger;
    this.options = { ...DEFAULT_PERSISTENCE_MODULE_OPTIONS, ...options };
    this.logger.log("PersistenceIndexDbModule initialized", "debug", "constructor", this.id);

    this.getRowsStream = this.getRowsStream.bind(this);
    this.getErrorsStream = this.getErrorsStream.bind(this);
  }

  getProgress = () => this.progress;

  private dbPromise: Promise<IDBDatabase> | null = null;

  private initDb: () => Promise<IDBDatabase> = async () => {
    this.logger.log("Initializing database", "debug", "initDb", this.id);
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.options.dbName!, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        this.logger.log("Database upgraded", "debug", "initDb", this.id);
        if (!db.objectStoreNames.contains(this.options.storeNames.rows)) {
          db.createObjectStore(this.options.storeNames.rows, {
            keyPath: this.options.storeKeys.rows,
          });
        }
        if (!db.objectStoreNames.contains(this.options.storeNames.errors)) {
          db.createObjectStore(this.options.storeNames.errors, {
            keyPath: this.options.storeKeys.errors,
          });
        }
        if (!db.objectStoreNames.contains(this.options.storeNames.metrics)) {
          db.createObjectStore(this.options.storeNames.metrics, {
            keyPath: this.options.storeKeys.metrics,
          });
        }
        if (!db.objectStoreNames.contains(this.options.storeNames.recoveryPoint)) {
          db.createObjectStore(this.options.storeNames.recoveryPoint, {
            keyPath: this.options.storeKeys.recoveryPoint,
          });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;

        this.db.onclose = () => {
          this.logger.log("Database connection closed unexpectedly", "warn", "initDb", this.id);
          this.db = null;
        };

        this.db.onversionchange = () => {
          this.logger.log(
            "Database version changed in another tab, closing connection",
            "warn",
            "initDb",
            this.id
          );
          this.db?.close();
          this.db = null;
          this.dbPromise = null;
        };

        resolve(this.db);
      };

      request.onerror = () => {
        reject(new Error("Failed to open database: " + request.error?.message));
      };
    });

    return this.dbPromise;
  };

  private isConnectionAlive = async (): Promise<boolean> => {
    if (!this.db) return false;
    try {
      this.db.transaction([], "readonly");
      return true;
    } catch {
      return false;
    }
  };

  private executeTransaction = async (
    mode: IDBTransactionMode,
    actions: { storeName: string; fn: (store: IDBObjectStore) => void | Promise<any> }[]
  ) => {
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      try {
        const db = await this.initDb();
        const storeNames = actions.map((action) => action.storeName);

        return await new Promise((resolve, reject) => {
          const transaction = db.transaction(storeNames, mode);

          const runActions = async () => {
            try {
              for (const action of actions) {
                const store = transaction.objectStore(action.storeName);
                await action.fn(store);
              }

              if (typeof transaction.commit === "function") {
                transaction.commit();
              }
            } catch (error) {
              if (transaction.db) transaction.abort();
              reject(error);
            }
          };

          transaction.oncomplete = () => resolve(true);

          transaction.onerror = () => {
            const error = transaction.error;
            if (error?.name === "QuotaExceededError") {
              this.logger.log(
                "Storage quota exceeded. Consider cleaning old data.",
                "error",
                "executeTransaction",
                this.id
              );
            }
            const errorMsg = error?.message || "Transaction failed";
            this.logger.log(
              "Transaction failed: " + errorMsg,
              "error",
              "executeTransaction",
              this.id
            );
            reject(new Error("Transaction failed: " + errorMsg));
          };

          runActions();
        });
      } catch (error) {
        attempts++;
        this.db = null; // Clean up instance for retry
        if (attempts >= maxAttempts) {
          this.logger.log(
            `Transaction failed after ${maxAttempts} attempts`,
            "error",
            "executeTransaction",
            this.id
          );
          throw error;
        }
        this.logger.log(
          `Retrying transaction... (attempt ${attempts}/${maxAttempts})`,
          "warn",
          "executeTransaction",
          this.id
        );
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  };

  getRecoveryPoint = async () => {
    const db = await this.initDb();
    const transaction = db.transaction(this.options.storeNames.recoveryPoint, "readonly");
    const store = transaction.objectStore(this.options.storeNames.recoveryPoint);
    return new Promise<RecoverPoint | undefined | null>((resolve, reject) => {
      const request = store.openCursor();

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          resolve(cursor.value as RecoverPoint | undefined);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  };

  updateRecoveryPoint = async (recoveryPoint: RecoverPoint) => {
    const db = await this.initDb();
    const transaction = db.transaction(this.options.storeNames.recoveryPoint, "readwrite");
    const store = transaction.objectStore(this.options.storeNames.recoveryPoint);
    const request = store.put(recoveryPoint);
    request.onsuccess = () => {
      this.logger.log("Recovery point updated", "debug", "updateRecoveryPoint", this.id);
    };
    request.onerror = () => {
      this.logger.log("Failed to update recovery point", "error", "updateRecoveryPoint", this.id);
      throw new Error("Failed to update recovery point");
    };
  };

  getRowsPaginated = async (options: GetRowsPaginatedOptions) => {
    const { filter = {}, limit = 100, cursor, direction = "next" } = options;

    const db = await this.initDb();
    const transaction = db.transaction(this.options.storeNames.rows, "readonly");
    const store = transaction.objectStore(this.options.storeNames.rows);

    let range: IDBKeyRange | null = null;

    const lower = direction === "next" ? (cursor ?? filter.fromRowId) : filter.fromRowId;

    const upper = direction === "prev" ? (cursor ?? filter.toRowId) : filter.toRowId;

    if (lower != null && upper != null) {
      range = IDBKeyRange.bound(lower, upper, lower === cursor, upper === cursor);
    } else if (lower != null) {
      range = IDBKeyRange.lowerBound(lower, lower === cursor);
    } else if (upper != null) {
      range = IDBKeyRange.upperBound(upper, upper === cursor);
    }

    const cursorDirection = direction == "next" ? "next" : "prev";
    const rows: RowObject[] = [];

    let firstCursor: number | null = null;
    let lastCursor: number | null = null;
    let hasExtraRow = false;

    await new Promise<void>((resolve, reject) => {
      const request = store.openCursor(range, cursorDirection);

      request.onsuccess = () => {
        const cursorResult = request.result;

        if (!cursorResult) {
          resolve();
          transaction.abort();
          return;
        }

        const row = cursorResult.value as RowObject;
        const rowId = row.__rowId;

        if (this.rowMatchesFilter(row, filter)) {
          if (rows.length < limit) {
            rows.push(row);

            firstCursor ??= rowId;
            lastCursor = rowId;
          } else {
            hasExtraRow = true;
            resolve();
            return;
          }
        }

        cursorResult.continue();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    if (direction == "prev") {
      rows.reverse();
    }

    return {
      rows,
      nextCursor: rows.at(-1)?.__rowId ?? null,
      prevCursor: rows.at(0)?.__rowId ?? null,
      hasNextPage: direction === "next" ? hasExtraRow : cursor != null,
      hasPrevPage: direction === "prev" ? hasExtraRow : cursor != null,
    };
  };

  getRowsStream(
    filter: RowFilter,
    abortSignal?: AbortSignal,
    batchSize?: number
  ): ReadableStream<{ rows: RowObject[] }> {
    const _batchSize = batchSize || this.options.chunkSizeQtd || 100;
    let lastRowId: number | null = null;
    let isFinished = false;

    const self = this;

    return new ReadableStream({
      async pull(controller) {
        if (isFinished) {
          controller.close();
          return;
        }

        abortSignal?.throwIfAborted();

        try {
          const db = await self.initDb();
          const transaction = db.transaction(self.options.storeNames.rows, "readonly");
          const store = transaction.objectStore(self.options.storeNames.rows);

          let range: IDBKeyRange | null = null;

          if (lastRowId !== null) {
            range = IDBKeyRange.lowerBound(lastRowId, true);
          }

          if (filter.fromRowId && filter.toRowId) {
            range = IDBKeyRange.bound(filter.fromRowId, filter.toRowId);
          } else if (filter.fromRowId) {
            range = IDBKeyRange.lowerBound(filter.fromRowId);
          } else if (filter.toRowId) {
            range = IDBKeyRange.upperBound(filter.toRowId);
          }

          const batchRows: RowObject[] = [];
          const cursorRequest = store.openCursor(range);

          const rowIdInSet = new Set<number>(filter.rowIdIn ?? []);
          let findedRowsInSet = 0;

          await new Promise<void>((resolve, reject) => {
            cursorRequest.onsuccess = () => {
              const cursor = cursorRequest.result;
              if (!cursor) {
                isFinished = true;
                resolve();
                return;
              }

              const row = cursor.value;

              const rowId = row[self.options.storeKeys.rows] as number;

              if (rowIdInSet.size > 0 && findedRowsInSet >= rowIdInSet.size) {
                isFinished = true;
                resolve();
                return;
              }

              if (rowIdInSet.size > 0 && !rowIdInSet.has(rowId)) {
                cursor.continue();
                return;
              }

              if (self.rowMatchesFilter(row, filter)) {
                batchRows.push(row);
                if (rowIdInSet.size > 0) {
                  findedRowsInSet++;
                }
                lastRowId = row[self.options.storeKeys.rows] as number;
              }

              if (batchRows.length < _batchSize) {
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
      },
    });
  }

  private rowMatchesFilter = (row: RowObject, filter: RowFilter) => {
    if (filter.withErrors == true && !row.__isError) return false;
    if (filter.withoutErrors == true && row.__isError) return false;

    if (filter.rowIdIn && filter.rowIdIn.length > 0 && !filter.rowIdIn.includes(row.__rowId))
      return false;

    if (filter.fromRowId && row.__rowId < filter.fromRowId) return false;
    if (filter.toRowId && row.__rowId > filter.toRowId) return false;

    if (filter.fields && filter.fields.length > 0) {
      for (const fieldFilter of filter.fields) {
        const rowValue = row.value?.[fieldFilter.headerKey];
        if (!this.evaluateOperator(rowValue, fieldFilter.operator, fieldFilter.value)) return false;
      }
    }

    return true;
  };

  private evaluateOperator = (rowValue: any, operator: string, filterValue: any) => {
    switch (operator) {
      case "=":
        return rowValue === filterValue;
      case "!=":
        return rowValue !== filterValue;
      case ">":
        return rowValue > filterValue;
      case "<":
        return rowValue < filterValue;
      case ">=":
        return rowValue >= filterValue;
      case "<=":
        return rowValue <= filterValue;
      case "includes": {
        const rowValStr = (rowValue ?? "").toString();
        const filterValStr = (filterValue ?? "").toString();
        return rowValStr.includes(filterValStr);
      }
      case "notIncludes": {
        const rowValStr = (rowValue ?? "").toString();
        const filterValStr = (filterValue ?? "").toString();
        return !rowValStr.includes(filterValStr);
      }
      case "startsWith": {
        const rowValStr = (rowValue ?? "").toString();
        const filterValStr = (filterValue ?? "").toString();
        return rowValStr.startsWith(filterValStr);
      }
      case "endsWith": {
        const rowValStr = (rowValue ?? "").toString();
        const filterValStr = (filterValue ?? "").toString();
        return rowValStr.endsWith(filterValStr);
      }
      case "isEmpty":
        return rowValue === null || rowValue === undefined || rowValue === "";
      case "isNotEmpty":
        return rowValue !== null && rowValue !== undefined && rowValue !== "";
      case "regex": {
        const rowValStr = (rowValue ?? "").toString();
        const filterValStr = (filterValue ?? "").toString();
        return new RegExp(filterValStr).test(rowValStr);
      }
      case "notRegex": {
        const rowValStr = (rowValue ?? "").toString();
        const filterValStr = (filterValue ?? "").toString();
        return !new RegExp(filterValStr).test(rowValStr);
      }
      case "isTrue":
        return rowValue === true;
      case "isFalse":
        return rowValue === false;
      case "isNotNull":
        return rowValue !== null;
      case "isNullish":
        return rowValue === null || rowValue === undefined;
      case "isDefined":
        return rowValue !== undefined;
      case "isNumber":
        return typeof rowValue === "number";
      default:
        return false;
    }
  };

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
          const transaction = db.transaction(self.options.storeNames.errors, "readonly");
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
      },
    });
  }

  getErrorById = async (id: number) => {
    const db = await this.initDb();
    return new Promise<ValidationError | undefined>((resolve, reject) => {
      const transaction = db.transaction(this.options.storeNames.errors, "readonly");
      const store = transaction.objectStore(this.options.storeNames.errors);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result ?? undefined);
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  };

  saveStream = async (
    stream: ReadableStream<{ rows: RowObject[]; errorDicc: Record<number, ValidationError> }>,
    totalRowEstimated: Signal<number | null> | null,
    onFirstChunkReady?: (() => void) | null,
    signal?: AbortSignal | null
  ) => {
    await this.initDb();

    let totalRowsProcessed = 0;
    let firstChunkReady = false;

    const writable = new WritableStream({
      write: async (chunk, controller) => {
        const { rows = [], errorDicc = {} } = chunk;

        this.logger.log(
          "Saving stream chunk. " +
            `totalRowsProcessed: ${totalRowsProcessed}, ` +
            "rows in chunk: " +
            rows.length,
          "debug",
          "saveStream",
          this.id
        );

        signal?.throwIfAborted();
        if (!rows || !Array.isArray(rows)) return;

        try {
          await this.executeTransaction("readwrite", [
            {
              storeName: this.options.storeNames.rows,
              fn: (store) => {
                rows.forEach((r) => store.put(r));
              },
            },
            {
              storeName: this.options.storeNames.errors,
              fn: (store) => {
                const errorDiccParsed = errorDicc as Record<number, ValidationError>;
                Object.entries(errorDiccParsed).forEach(([rowId, error]) => {
                  store.put({ [this.options.storeKeys.errors]: Number(rowId), error });
                });
              },
            },
          ]);
          this.logger.log(
            `Processed ${rows.length} rows successfully`,
            "debug",
            "saveStream",
            this.id
          );

          totalRowsProcessed += rows.length;
          if (totalRowEstimated !== null) {
            this.progress.value = Math.round(
              (totalRowsProcessed / (totalRowEstimated?.value ?? 0)) * 100
            );
          } else {
            this.progress.value = null;
          }
        } catch (error) {
          this.logger.log(
            `Error saving stream chunk: ${error instanceof Error ? error.message : String(error)}`,
            "error",
            "saveStream",
            this.id
          );
          throw error;
        } finally {
          if (!firstChunkReady && onFirstChunkReady) {
            onFirstChunkReady();
            firstChunkReady = true;
          }
        }
      },
      close: async () => {
        this.logger.log("Writable stream closed", "debug", "saveStream", this.id);
        this.progress.value = null;
      },
      abort: (reason) => {
        this.logger.log(`Writable stream aborted: ${reason}`, "warn", "saveStream", this.id);
      },
    });

    try {
      await stream.pipeTo(writable);
      this.logger.log("Stream processing completed successfully", "debug", "saveStream", this.id);
    } catch (error) {
      this.logger.log(
        `Stream pipeline failed: ${error instanceof Error ? error.message : String(error)}`,
        "error",
        "saveStream",
        this.id
      );
      throw error;
    }
  };

  clear: () => Promise<void> = async () => {
    if (this.db) {
      this.db.close();
      this.db = null;
    }

    this.dbPromise = null;

    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(this.options.dbName!);
      request.onsuccess = () => {
        this.logger.log("Database deleted successfully", "debug", "clear", this.id);
        resolve();
      };
      request.onerror = () => {
        this.logger.log(
          "Error deleting database: " + request.error?.message,
          "error",
          "clear",
          this.id
        );
        reject(request.error);
      };
      request.onblocked = () => {
        this.logger.log("Database is blocked", "error", "clear", this.id);
      };
    });
  };

  getRowById: (id: number) => Promise<RowObject | undefined> = async (id: number) => {
    const db = await this.initDb();

    return new Promise<RowObject | undefined>((resolve, reject) => {
      const transaction = db.transaction(this.options.storeNames.rows, "readonly");

      const storeRows = transaction.objectStore(this.options.storeNames.rows);

      const request = storeRows.get(id);
      request.onsuccess = () => {
        resolve(request.result ?? undefined);
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  };

  updateRow: (row: RowObject) => Promise<void> = async (row: RowObject) => {
    await this.executeTransaction("readwrite", [
      {
        storeName: this.options.storeNames.rows,
        fn: (store) => {
          store.put(row);
        },
      },
    ]);
    const error = await this.getErrorById(row.__rowId);
    if (error) {
      await this.deleteErrors([row.__rowId]);
    }
  };

  deleteRow: (id: number) => Promise<void> = async (id: number) => {
    const currentError: ValidationError | undefined = await this.getErrorById(id);
    await this.executeTransaction("readwrite", [
      {
        storeName: this.options.storeNames.rows,
        fn: (store) => {
          store.delete(id);
        },
      },
      {
        storeName: this.options.storeNames.errors,
        fn: (store) => {
          if (currentError) {
            store.delete(id);
          }
        },
      },
    ]);
  };

  deleteErrors: (ids: number[]) => Promise<void> = async (ids: number[]) => {
    await this.executeTransaction("readwrite", [
      {
        storeName: this.options.storeNames.errors,
        fn: (store) => {
          ids.forEach((id) => store.delete(id));
        },
      },
    ]);
  };

  updateMetrics: (fileName: string, filter?: RowFilter) => Promise<void> = async (
    fileName: string,
    filter
  ) => {
    // 1. Get base metrics
    const metrics = (await this.getMetrics(fileName)) ?? {
      [this.options.storeKeys.metrics]: fileName,
      totalRows: 0,
      totalErrorRows: 0,
    };

    let totalRows = 0;
    let totalErrors = 0;

    this.logger.log("Updating metrics for file: " + fileName, "debug", "updateMetrics", this.id);

    if (filter && !isEqual(filter, {})) {
      const reader = this.getRowsStream(filter).getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          totalRows += value.rows.length;
          totalErrors += value.rows.filter((e) => e.__isError).length;
        }
      } catch (error) {
        throw new Error("Error counting filtered db");
      } finally {
        reader.releaseLock();
      }
    } else {
      await this.executeTransaction("readonly", [
        {
          storeName: this.options.storeNames.rows,
          fn: (store) =>
            new Promise<void>((resolve, reject) => {
              const req = store.count();
              req.onsuccess = () => {
                totalRows = req.result;
                resolve();
              };
              req.onerror = () => reject(req.error);
            }),
        },
        {
          storeName: this.options.storeNames.errors,
          fn: (store) =>
            new Promise<void>((resolve, reject) => {
              const req = store.count();
              req.onsuccess = () => {
                totalErrors = req.result;
                resolve();
              };
              req.onerror = () => reject(req.error);
            }),
        },
      ]);
    }
    await this.executeTransaction("readwrite", [
      {
        storeName: this.options.storeNames.metrics,
        fn: (store) => {
          store.put({
            ...metrics,
            totalRows,
            totalErrorRows: totalErrors,
          });
        },
      },
    ]);
  };

  getMetrics: (fileName: string) => Promise<FileMetrics | undefined> = async (fileName: string) => {
    const db = await this.initDb();
    const transaction = db.transaction(this.options.storeNames.metrics, "readonly");
    const store = transaction.objectStore(this.options.storeNames.metrics);

    return new Promise((resolve, reject) => {
      const request = store.get(fileName);
      request.onsuccess = () => {
        resolve(request.result ?? undefined);
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  };

  updateOptions(options: Partial<PersistenceModuleOptions>): void {
    this.options = { ...this.options, ...options };
  }
}
