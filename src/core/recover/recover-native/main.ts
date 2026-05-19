import type { LoggerModule } from "@/core/logger/logger-native/main";
import type { IRecoverModule, RecoverModuleOptions } from "../i-recover-module";
import { DEFAULT_RECOVER_MODULE_OPTIONS } from "../i-recover-module";
import type { LayoutBase } from "@/shared";
import type { RecoverPoint } from "@/shared/schemes/recover-point";
import type { IPersistenceModule } from "@/core/persistence";

export class RecoverNativeModule implements IRecoverModule {
  id: string = "recover-native";
  private logger: LoggerModule;
  private options: RecoverModuleOptions;

  availableLayouts: LayoutBase[];

  constructor(logger: LoggerModule, options: RecoverModuleOptions = {}) {
    this.logger = logger;
    this.options = { ...DEFAULT_RECOVER_MODULE_OPTIONS, ...options };
    this.availableLayouts = this.options.availableLayouts;
  }

  setAvailableLayouts(layout: LayoutBase[]): Promise<void> {
    this.options.availableLayouts = layout;
    return Promise.resolve();
  }

  updateOptions(options: Partial<RecoverModuleOptions>): void {
    this.options = { ...this.options, ...options };
  }
  async setRecoveryPoint(
    recoveryPoint: RecoverPoint,
    persistenceModule: IPersistenceModule
  ): Promise<void> {
    this.options.recoveryPoint = recoveryPoint;
    await persistenceModule.updateRecoveryPoint(recoveryPoint);
  }
  async getRecoveryPoint(persistenceModule: IPersistenceModule): Promise<RecoverPoint | null> {
    const recoveryPoint = await persistenceModule.getRecoveryPoint();
    if (recoveryPoint) {
      this.options.recoveryPoint = recoveryPoint;
    }
    return recoveryPoint ?? null;
  }
}
