import type { LayoutBase } from "@/shared";
import type { RecoverPoint } from "@/shared/schemes/recover-point";
import type { IPersistenceModule } from "../persistence";

export type RecoverModuleOptions = {
  recoveryPoint?: RecoverPoint;
  availableLayouts?: LayoutBase[];
  checkRecoveryPoint?: boolean;
};

export const DEFAULT_RECOVER_MODULE_OPTIONS: RecoverModuleOptions = {
  checkRecoveryPoint: false,
  availableLayouts: [],
  recoveryPoint: undefined,
};

export interface IRecoverModule {
  setRecoveryPoint(
    recoveryPoint: RecoverPoint,
    persistenceModule: IPersistenceModule
  ): Promise<void>;
  getRecoveryPoint(persistenceModule: IPersistenceModule): Promise<RecoverPoint | null>;
  availableLayouts: LayoutBase[];
  setAvailableLayouts(layout: LayoutBase[]): Promise<void>;
  updateOptions(options: Partial<RecoverModuleOptions>): void;
}
