import type { IViewerModule, ViewerModuleOptions } from "@/core/viewer/i-viewer-module";
import { DEFAULT_VIEWER_MODULE_OPTIONS } from "@/core/viewer/i-viewer-module";
import type {
  GlobalStepsEngineModuleOptions,
  IGlobalStepsEngineModule,
} from "@/core/steps-engine/i-global-steps-engine-module";
import type {
  ILocalStepsEngineModule,
  LocalStepsEngineModuleOptions,
} from "@/core/steps-engine/i-local-steps-engine-module";
import type {
  IPersistenceModule,
  PersistenceModuleOptions,
} from "@/core/persistence/i-persistence-module";
import { DEFAULT_PERSISTENCE_MODULE_OPTIONS } from "@/core/persistence/i-persistence-module";
import type { IMappingModule, MappingModuleOptions } from "@/core/mapping/i-mapping-module";
import { DEFAULT_MAP_HEADERS_OPTIONS } from "@/core/mapping/i-mapping-module";
import type { ILoggerModule, LoggerModuleOptions } from "@/core/logger/i-logger-module";
import type {
  IImportFileModule,
  ImportFileModuleOptions,
} from "@/core/import-file/i-import-file-module";
import type { IExporterModule, ExporterModuleOptions } from "@/core/exporter/i-exporter-module";

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
  };

  options: {
    logger?: LoggerModuleOptions;
    importer?: ImportFileModuleOptions;
    mapper?: MappingModuleOptions;
    localStepEngine?: LocalStepsEngineModuleOptions;
    globalStepEngine?: GlobalStepsEngineModuleOptions;
    exporter?: ExporterModuleOptions;
    viewer?: ViewerModuleOptions;
  };

  constructor(config: IProviderModuleConfig) {
    const logger = new config.logger.module(config.logger.options ?? {});
    const persistence: IPersistenceModule = new config.persistence.module(
      logger,
      config.persistence.options ?? DEFAULT_PERSISTENCE_MODULE_OPTIONS
    );

    this.modules = {
      logger,
      persistence,
      importer: new config.importer.module(logger, config.importer.options ?? {}),
      mapper: new config.mapper.module(
        logger,
        config.mapper.options ?? DEFAULT_MAP_HEADERS_OPTIONS
      ),
      localStepEngine: new config.localStepEngine.module(
        logger,
        config.localStepEngine.options ?? {}
      ),
      globalStepEngine: new config.globalStepEngine.module(
        logger,
        config.globalStepEngine.options ?? {}
      ),
      exporter: new config.exporter.module(logger, config.exporter.options ?? {}),
      viewer: new config.viewer.module(
        logger,
        config.viewer.options ?? DEFAULT_VIEWER_MODULE_OPTIONS
      ),
    };

    this.options = {
      logger: config.logger.options,
      importer: config.importer.options,
      mapper: config.mapper.options,
      localStepEngine: config.localStepEngine.options,
      globalStepEngine: config.globalStepEngine.options,
      exporter: config.exporter.options,
      viewer: config.viewer.options,
    };
  }
}
