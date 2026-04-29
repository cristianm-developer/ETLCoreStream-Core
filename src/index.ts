// ============================================================================
// CORE MODULE: Orchestrator (Main Entry Point)
// ============================================================================
export { OrchestatorModule } from '@/core/orchestator/main';
export type {
  OrchestatorContext
} from '@/core/orchestator/schemes/orchestator-context';

// ============================================================================
// CORE MODULE: Provider (Required for initialization)
// ============================================================================
export { ProviderModule } from '@/core/provider/main';
export type { IProviderModuleConfig } from '@/core/provider/main';

// ============================================================================
// CORE MODULES: Configuration Interfaces
// ============================================================================
export type { IExporterModule, ExportTemplate, ExportTransform, ExporterModuleOptions } from '@/core/exporter/i-exporter-module';
export type { IViewerModule, PaginatedRows, EditRowPayload } from '@/core/viewer/i-viewer-module';
export type { IImportFileModule, ImportFileModuleOptions as StreamConfig, StreamControls as ImportStreamControls, StreamResult as ImportStreamResult } from '@/core/import-file/i-import-file-module';
export type { ILoggerModule, LogLevel, StatusType, StatusLog } from '@/core/logger/i-logger-module';
export type { IMappingModule, MappingModuleOptions as MapHeadersOptions } from '@/core/mapping/i-mapping-module';
export type { ILocalStepsEngineModule, LocalStepsEngineModuleOptions } from '@/core/steps-engine/i-local-steps-engine-module';
export type { IGlobalStepsEngineModule, GlobalStepsEngineModuleOptions } from '@/core/steps-engine/i-global-steps-engine-module';
export type { IPersistenceModule, PersistenceModuleOptions } from '@/core/persistence/i-persistence-module';

// ============================================================================
// SHARED: Schemes and Data Models
// ============================================================================
export type { RowObject } from '@/shared/schemes/row-object';
export type { LayoutBase } from '@/shared/schemes/layout-base';
export type { LayoutHeader } from '@/shared/schemes/layout-header';
export type { LayoutLocalStep } from '@/shared/schemes/layout-local-step';
export type { GlobalStep } from '@/shared/schemes/layout-global-step';
export type { RowFilter } from '@/shared/schemes/persistent-filter';
export type { ValidationError } from '@/shared/schemes/local-step-validators';
export type { FileMetrics } from '@/shared/schemes/file-metrics';
export type { Log } from '@/shared/schemes/log';

// ============================================================================
// PRESETS: Pre-configured Module Combinations
// ============================================================================
export { createBrowserProvider, type BrowserProviderConfig } from '@/presets/main';

// ============================================================================
// SHARED: Utilities
// ============================================================================
export { yieldControl as yieldControlToEventLoop } from '@/shared/utils/yield';
