import { IViewerModule, ViewerModuleOptions } from "@/core/viewer/i-viewer-module";
import { GlobalStepsEngineModuleOptions, IGlobalStepsEngineModule } from "@/core/steps-engine/i-global-steps-engine-module";
import { ILocalStepsEngineModule, LocalStepsEngineModuleOptions, DEFAULT_STEPS_ENGINE_OPTIONS } from "@/core/steps-engine/i-local-steps-engine-module";
import { IPersistenceModule, PersistenceModuleOptions, DEFAULT_PERSISTENCE_MODULE_OPTIONS } from "@/core/persistence/i-persistence-module";
import { IMappingModule, MappingModuleOptions, DEFAULT_MAP_HEADERS_OPTIONS } from "@/core/mapping/i-mapping-module";
import { ILoggerModule, LoggerModuleOptions } from "@/core/logger/i-logger-module";
import { IImportFileModule, ImportFileModuleOptions, DEFAULT_IMPORT_FILE_MODULE_OPTIONS } from "@/core/import-file/i-import-file-module";
import { IExporterModule, ExporterModuleOptions, DEFAULT_EXPORTER_OPTIONS } from "@/core/exporter/i-exporter-module";

type Module<T, C> = new (logger: ILoggerModule, config: C) => T;
type Logger<C> = new (config: C) => ILoggerModule;

export interface IProviderModuleConfig {
    logger: {
        module: Logger<LoggerModuleOptions>;
        options?: LoggerModuleOptions;
    };
    importer: {
        module: Module<IImportFileModule, ImportFileModuleOptions>;
        options?: ImportFileModuleOptions;
    };
    mapper: {
        module: Module<IMappingModule, MappingModuleOptions>;
        options?: MappingModuleOptions;
    };
    localStepEngine: {
        module: Module<ILocalStepsEngineModule, LocalStepsEngineModuleOptions>;
        options?: LocalStepsEngineModuleOptions;
    };
    persistence: {
        module: Module<IPersistenceModule, PersistenceModuleOptions>;
        options?: PersistenceModuleOptions;
    };
    globalStepEngine: {
        module: Module<IGlobalStepsEngineModule, GlobalStepsEngineModuleOptions>;
        options?: GlobalStepsEngineModuleOptions;
    };
    exporter: {
        module: Module<IExporterModule, ExporterModuleOptions>;
        options?: ExporterModuleOptions;
    };
    viewer: {
        module: Module<IViewerModule, ViewerModuleOptions>;
        options?: ViewerModuleOptions;
    };
}

export class ProviderModule {

    modules: {
        logger: ILoggerModule;
        importer: IImportFileModule;
        mapper: IMappingModule;
        persistence: IPersistenceModule;
        localStepEngine: ILocalStepsEngineModule;
        globalStepEngine: IGlobalStepsEngineModule;
        exporter: IExporterModule;
        viewer: IViewerModule;
    }

    options: {
        logger?: LoggerModuleOptions;
        importer?: ImportFileModuleOptions;
        mapper?: MappingModuleOptions;
        localStepEngine?: LocalStepsEngineModuleOptions;
        globalStepEngine?: GlobalStepsEngineModuleOptions;
        exporter?: ExporterModuleOptions;
        viewer?: ViewerModuleOptions;
    }

    constructor(config: IProviderModuleConfig) {

        let logger = new config.logger.module(config.logger.options);
        let persistence: IPersistenceModule = new config.persistence.module(logger, config.persistence.options);

        this.modules = {
            logger,
            persistence,
            importer: new config.importer.module(logger, config.importer.options),
            mapper: new config.mapper.module(logger, config.mapper.options),
            localStepEngine: new config.localStepEngine.module(logger, config.localStepEngine.options),
            globalStepEngine: new config.globalStepEngine.module(logger, config.globalStepEngine.options),
            exporter: new config.exporter.module(logger, config.exporter.options),
            viewer: new config.viewer.module(logger, config.viewer.options),      
        }

        this.options = {
            logger: config.logger.options,
            importer: config.importer.options,
            mapper: config.mapper.options,
            localStepEngine: config.localStepEngine.options,
            globalStepEngine: config.globalStepEngine.options,
            exporter: config.exporter.options,
            viewer: config.viewer.options,
        }
    }


}