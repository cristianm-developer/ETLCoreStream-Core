import type { RemapFn } from "@/core";
import { OrchestratorModule, type ViewerModuleOptions } from "@/core";
import { ExporterNativeModule } from "@/core/exporter/exporter-native/main";
import { DEFAULT_IMPORT_FILE_MODULE_OPTIONS } from "@/core/import-file/i-import-file-module";
import { ImportFilePapaparseModule } from "@/core/import-file/import-file-Papaparse/main";
import { LoggerModule } from "@/core/logger/logger-native/main";
import { DEFAULT_MAP_HEADERS_OPTIONS, MappingModule } from "@/core/mapping/mapping-native/main";
import { DEFAULT_PERSISTENCE_MODULE_OPTIONS } from "@/core/persistence/i-persistence-module";
import { PersistenceIndexDbModule } from "@/core/persistence/persistence-indexdb/main";
import { ProviderModule, type IProviderModuleConfig } from "@/core/provider/main";
import { DEFAULT_RECOVER_MODULE_OPTIONS } from "@/core/recover/i-recover-module";
import { RecoverNativeModule } from "@/core/recover/recover-native/main";
import { GlobalStepsEngineModule } from "@/core/steps-engine/global-steps-engine/main";
import {
  DEFAULT_STEPS_ENGINE_OPTIONS,
  LocalStepsEngineModule,
} from "@/core/steps-engine/local-steps-engine/main";
import { ViewerModule } from "@/core/viewer/viewer-native/main";
import type { LayoutBase } from "@/shared";
import type { RecoverPoint } from "@/shared/schemes/recover-point";

/**
 * Browser preset configuration.
 * Provides an easy way to inject browser-specific options.
 */
export interface BrowserProviderConfig {
  /** Importer module options. */
  importer: {
    /** Size in bytes of each read chunk (e.g. recommended between 1–5MB). */
    importerChunkSize?: number;
    /** Allowed mime types for uploads (e.g. `["text/csv"]`). */
    allowedMimetypes?: string[];
    /** Maximum allowed file size in bytes. */
    maxFileSize?: number;
  };

  /** Mapping module (column mapping) options. */
  mapper: {
    /** Allow manual remapping of columns. */
    allowRemapColumns?: boolean;
    /** Ignore remaps for non-required columns. */
    ignoreRemapUnrequired?: boolean;
    /** Async hook for automatic remapping. */
    onRemapFn?: RemapFn;
    /** Preserve the original value when mapping. */
    preserveOriginalValue?: boolean;
  };

  /** Recover module options. */
  recover: {
    /** Enable recovery point verification. */
    checkRecoveryPoint?: boolean;
    /** Layouts available for recovery. */
    availableLayouts?: LayoutBase[];
    /** Initial recovery point. */
    recoveryPoint?: RecoverPoint;
  };

  /** Viewer / data tabulation options. */
  viewer: {
    /** Default page size for the viewer. */
    defaultPageSize?: number;
  };

  /** Local steps engine options. */
  localStepEngine: {
    /** Error limit before stopping local processing. */
    maxErrorCount?: number;
  };

  /** Data persistence options. */
  persistence: {
    /** Number of rows per persistence operation. */
    chunkSizeQtd?: number;
  };
}

/**
 * Creates and returns a preconfigured `ProviderModule` for browser usage.
 *
 * The optional `config` allows tuning chunk sizes, file limits,
 * mapper behavior, persistence, and viewer options. Options not provided
 * are merged with the default values exported by core modules
 * (see `DEFAULT_*_OPTIONS` in this file).
 *
 * Usage:
 * const provider = BrowserProviderPreset({ importer: { importerChunkSize: 5_242_880 } });
 *
 * @param {BrowserProviderConfig} [config] - Options specific to the Browser preset.
 * @returns {ProviderModule} Provider preconfigured with required modules (logger, importer, mapper, persistence, viewer, exporter, etc).
 */
export const BrowserProviderPreset = (config?: BrowserProviderConfig) => {
  const providerConfig: IProviderModuleConfig = {
    logger: {
      module: LoggerModule as any,
    },
    recover: {
      module: RecoverNativeModule as any,
      options: {
        ...DEFAULT_RECOVER_MODULE_OPTIONS,
        ...config?.recover,
      },
    },
    importer: {
      module: ImportFilePapaparseModule as any,
      options: {
        ...DEFAULT_IMPORT_FILE_MODULE_OPTIONS,
        ...config?.importer,
      },
    },
    mapper: {
      module: MappingModule as any,
      options: {
        ...DEFAULT_MAP_HEADERS_OPTIONS,
        ...config?.mapper,
      },
    },
    localStepEngine: {
      module: LocalStepsEngineModule as any,
      options: {
        ...DEFAULT_STEPS_ENGINE_OPTIONS,
        ...config?.localStepEngine,
      },
    },
    persistence: {
      module: PersistenceIndexDbModule as any,
      options: {
        ...DEFAULT_PERSISTENCE_MODULE_OPTIONS,
        ...config?.persistence,
      },
    },
    globalStepEngine: {
      module: GlobalStepsEngineModule as any,
    },
    viewer: {
      module: ViewerModule as any,
      options: {
        defaultPageSize: config?.viewer?.defaultPageSize ?? 100,
        defaultFilter: {},
      } satisfies ViewerModuleOptions,
    },
    exporter: {
      module: ExporterNativeModule as any,
    },
  };

  return new ProviderModule(providerConfig);
};

/**
 * Creates an `OrchestratorModule` initialized with the Browser preset.
 *
 * - Initializes the provider using `BrowserProviderPreset(config)` and injects it
 *   into the `OrchestratorModule`.
 * - Ideal for bootstrapping the web app following the guide in `docs/how-to-implement-web.md`.
 *
 * @param {BrowserProviderConfig} [config] - Options passed to the provider preset.
 * @returns {OrchestratorModule} Orchestrator initialized and ready to use.
 */
export const ETLBrowserOrchestrator = (config?: BrowserProviderConfig) => {
  const orchestrator = new OrchestratorModule();
  const provider = BrowserProviderPreset(config);
  orchestrator.initialize(provider);

  return orchestrator;
};
