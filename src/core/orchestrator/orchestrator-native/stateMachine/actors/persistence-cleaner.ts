import type { IPersistenceModule } from "@/core/persistence/i-persistence-module";
import { fromPromise } from "xstate";
import type { OrchestratorContext } from "../schemes/context";

type PersistenceCleanerInput = {
  context: OrchestratorContext;
};

export const persistenceCleaner = fromPromise<void, PersistenceCleanerInput>(async ({ input }) => {
  const persistenceModule = input.context.modules!.persistence! as IPersistenceModule;
  await persistenceModule.clear();
});
