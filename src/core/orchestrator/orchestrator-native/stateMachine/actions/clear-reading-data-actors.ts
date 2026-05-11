import { stopChild } from "xstate";
import { ACTORS_IDS } from "../consts/actors-ids";

export const clearReadingDataActorsAction = [
  stopChild(ACTORS_IDS.IMPORTER_HANDLER),
  stopChild(ACTORS_IDS.MAPPING_HANDLER),
  stopChild(ACTORS_IDS.LOCAL_STEPS_HANDLER),
  stopChild(ACTORS_IDS.PERSISTENCE_HANDLER),
  stopChild(ACTORS_IDS.GLOBAL_STEPS_HANDLER),
];
