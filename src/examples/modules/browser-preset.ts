
import { ExporterNativeModule } from "@/core/exporter/exporter-native/main";
import { DEFAULT_IMPORT_FILE_MODULE_OPTIONS } from "@/core/import-file/i-import-file-module";
import { ImportFilePapaparseModule } from "@/core/import-file/import-file-Papaparse/main";
import { LoggerModule } from "@/core/logger/logger-native/main"
import { DEFAULT_MAP_HEADERS_OPTIONS, MappingModule } from "@/core/mapping/mapping-native/main";
import { OrchestatorModule } from "@/core/orchestator/main";
import { DEFAULT_PERSISTENCE_MODULE_OPTIONS } from "@/core/persistence/i-persistence-module";
import { PersistenceIndexDbModule } from "@/core/persistence/persistence-indexdb/main";
import { IProviderModuleConfig, ProviderModule } from "@/core/provider/main"
import { GlobalStepsEngineModule } from "@/core/steps-engine/global-steps-engine/main";
import { DEFAULT_STEPS_ENGINE_OPTIONS, LocalStepsEngineModule } from "@/core/steps-engine/local-steps-engine/main";
import { ViewerModule } from "@/core/viewer/viewer-native/main";
import { LayoutHeader } from "@/shared/schemes/layout-header";

export interface BrowserProviderConfig {
    importer: {
        importerChunkSize?: number;
        allowedMimetypes?: string[];
        maxFileSize?: number;
    },
    mapper: {
        allowRemapColumns?: boolean;
        ignoreRemapUnrequired?: boolean;
        onRemapFn?: (rowKeys: string[], headers: LayoutHeader[]) => Promise<[string, string][]>;
        preserveOriginalValue?: boolean;
    },
    localStepEngine: {
        maxErrorCount?: number;
    },
    persistence: {
        chunkSizeQtd?: number;
    }
}



export const BrowserProviderPreset = (config?: BrowserProviderConfig) => {
    let providerConfig: IProviderModuleConfig = {
        logger: {
            module:  LoggerModule,
        },
        importer: {
            module: ImportFilePapaparseModule,
            options: {
                ...DEFAULT_IMPORT_FILE_MODULE_OPTIONS,
                ...config?.importer,                
            }
        },
        mapper: {
            module: MappingModule,
            options: {
                ...DEFAULT_MAP_HEADERS_OPTIONS,
                ...config?.mapper,
            }
        },
        localStepEngine: {
            module: LocalStepsEngineModule,
            options: {
                ...DEFAULT_STEPS_ENGINE_OPTIONS,
                ...config?.localStepEngine,
            }
        },
        persistence: {
            module: PersistenceIndexDbModule,
            options: {
                ...DEFAULT_PERSISTENCE_MODULE_OPTIONS,
                ...config?.persistence,
            }
        },
        globalStepEngine: {
            module: GlobalStepsEngineModule
        },
        viewer: {
            module: ViewerModule
        },
        exporter: {
            module: ExporterNativeModule
        }
    }

    return new ProviderModule(providerConfig);
}

export const ETLBrowserOrchestrator = (config?: BrowserProviderConfig) => {
    const orchestrator = new OrchestatorModule();
    const provider = BrowserProviderPreset(config);
    orchestrator.initialize(provider);

    return orchestrator;
}