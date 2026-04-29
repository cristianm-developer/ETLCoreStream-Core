import { LoggerModule } from "@/core/logger/logger-native/main";
import { IPersistenceModule } from "@/core/persistence/i-persistence-module";
import { IViewerModule, PaginatedRows, EditRowPayload, ViewerModuleOptions } from "../i-viewer-module";
import { RowFilter } from "@/shared/schemes/persistent-filter";
import { LayoutBase } from "@/shared/schemes/layout-base";
import { RowObject } from "@/shared/schemes/row-object";
import { ILocalStepsEngineModule } from "@/core/steps-engine/i-local-steps-engine-module";
import { IGlobalStepsEngineModule } from "@/core/steps-engine/i-global-steps-engine-module";
import { FileMetrics } from "@/shared/schemes/file-metrics";
import { Observable, Subject } from "rxjs";
import { pseudoRandomBytes } from "node:crypto";
import { ValidationError } from "@/shared/schemes/local-step-validators";


export class ViewerModule implements IViewerModule {
    id: string = 'viewer-native';

    private logger: LoggerModule;
    private options: ViewerModuleOptions;

    constructor(
        logger: LoggerModule,
        options: ViewerModuleOptions
    ){
        this.logger = logger;
        this.options = options;
        this.logger.log('ViewerModule initialized', 'debug', 'constructor', this.id);
    }    

    getRowsWithPagination = async (persistenceModule: IPersistenceModule, metrics: FileMetrics,  filter?: RowFilter, pageNumber?: number, signal?: AbortSignal) => {
        try {
            this.logger.log(`Fetching rows with pagination - page: ${pageNumber}, pageSize: ${this.options.defaultPageSize}`, 'debug', 'getRowsWithPagination', this.id);

            let innerFilter: RowFilter = { fromRowId: 1, toRowId: this.options.defaultPageSize, ...filter };
            pageNumber = pageNumber ?? 1;

            signal?.throwIfAborted();

            if(pageNumber > 1) {
                innerFilter.fromRowId = (pageNumber - 1) * this.options.defaultPageSize + 1;
                innerFilter.toRowId = pageNumber * this.options.defaultPageSize;
            }

            const rowsStream = persistenceModule.getRowsStream(innerFilter)
            const reader = rowsStream.getReader();

            const rows: RowObject[] = [];
            const totalRows = metrics.totalRows;
            const totalPages = Math.ceil(totalRows / this.options.defaultPageSize);

            if(pageNumber > totalPages && totalPages > 0) {
                pageNumber = totalPages;
            }

            try {
                while (true) {
                    signal?.throwIfAborted();
                    const { done, value } = await reader.read();
                    if (done) break;
                    rows.push(...value.rows);
                }
            } finally {
                reader.releaseLock();
            }

            const errors: ValidationError[] = [];
            const errorsStream = persistenceModule.getErrorsStream({ fromRowId: innerFilter.fromRowId, toRowId: innerFilter.toRowId });
            const errorsReader = errorsStream.getReader();

            try {
                while (true) {
                    const { done, value } = await errorsReader.read();
                    if (done) break;
                    errors.push(...value.errors);
                }
            } finally {
                errorsReader.releaseLock();
            }

            return {
                rows,
                errors,
                totalRows,
                pageSize: this.options.defaultPageSize,
                currentPage: pageNumber,
                totalPages
            };

        } catch (error) {
            this.logger.log(`Error fetching rows with pagination: ${error.message}`, 'error', 'getRowsWithPagination', this.id);
            throw error;
        }
    };

    editRow = async (persistenceModule: IPersistenceModule, payload: EditRowPayload, signal?: AbortSignal): Promise<void> => {
        try {
            const { rowId, headerKeyEdited, newValue } = payload;
            this.logger.log(`Editing row ${rowId}, field: ${headerKeyEdited}`, 'debug', 'editRow', this.id);

            signal?.throwIfAborted();

            let row = await persistenceModule.getRowById(rowId);
            if (!row) {
                throw new Error(`Row ${rowId} not found`);
            }            

            signal?.throwIfAborted(); 

            row.value[headerKeyEdited] = newValue;
            row.__sError = null;

            await persistenceModule.updateRow(row);
            this.logger.log(`Row ${rowId} updated in persistence`, 'debug', 'editRow', this.id);
            
        } catch (error) {
            this.logger.log(`Error editing row: ${error.message}`, 'error', 'editRow', this.id);
            throw error;
        }
    }

    removeRow = async (persistenceModule: IPersistenceModule, rowId: number, signal?: AbortSignal): Promise<void> => {
        try {
            this.logger.log(`Removing row ${rowId}`, 'debug', 'removeRow', this.id);

            const rowToRemove = await persistenceModule.getRowById(rowId);        
            await persistenceModule.deleteRow(rowId);
            await persistenceModule.deleteErrors([rowId]);

            await persistenceModule.updateMetrics();

            this.logger.log(`Row ${rowId} removed from persistence`, 'debug', 'removeRow', this.id);

        } catch (error) {
            this.logger.log(`Error removing rows: ${error.message}`, 'error', 'removeRows', this.id);
            throw error;
        }
    }

}
