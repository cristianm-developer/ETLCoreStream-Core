import type { ILoggerModule } from "@/core";
import type { ProviderModule } from "@/core/provider/main";
import type {
  FileMetrics,
  Log,
  LayoutBase,
  Notification,
  RowObject,
  ValidationError,
  RowFilter,
} from "@/shared";
import type { Observable } from "rxjs";
import { BehaviorSubject, distinctUntilChanged, from, map, Subscription } from "rxjs";
import type { IOrchestratorModule } from "../i-orchestrator-module";
import type { ActorRefFrom, createMachine, SnapshotFrom } from "xstate";
import { createActor } from "xstate";
import { mainStateMachine } from "./stateMachine/state-machine-root";
import type { OrchestratorContext } from "./stateMachine/schemes/context";
import type { Signal } from "@preact/signals-core";
import { computed, signal } from "@preact/signals-core";
import { isEqual } from "lodash-es";
import type {
  ChangeFilterEvent,
  ChangePageEvent,
  EditRowEvent,
  ExportEvent,
  RemoveRowEvent,
  ResetEvent,
} from "./stateMachine/events/user-events";
import type { FileSelectedEvent, LayoutSelectedEvent } from "./stateMachine/events/waiting-inputs";

export class OrchestratorModule implements IOrchestratorModule {
  private contextSubject = new BehaviorSubject<OrchestratorContext | null>(null);
  context$: Observable<OrchestratorContext | null> = this.contextSubject.asObservable();
  private contextSignal = signal<OrchestratorContext | null>(null);
  context = computed(() => this.contextSignal.value);

  private progressSubject = new BehaviorSubject<{ label: string; value: number | null }[]>([]);
  progress$: Observable<{ label: string; value: number | null }[]> =
    this.progressSubject.asObservable();
  private progressSignal = signal<{ label: string; value: number | null }[]>([]);
  progress = computed(() => this.progressSignal.value);

  private stateSubject = new BehaviorSubject<any>(null);
  state$: Observable<any> = this.stateSubject.asObservable();
  private stateSignal = signal<any>(null);
  state = computed(() => this.stateSignal.value);

  private metricsSubject = new BehaviorSubject<FileMetrics | null>(null);
  metrics$: Observable<FileMetrics | null> = this.metricsSubject.asObservable();
  private metricsSignal = signal<FileMetrics | null>(null);
  metrics: Signal<FileMetrics | null> = computed(() => this.metricsSignal.value);

  private layoutSubject = new BehaviorSubject<LayoutBase | null>(null);
  layout$: Observable<LayoutBase | null> = this.layoutSubject.asObservable();
  private layoutSignal = signal<LayoutBase | null>(null);
  layout = computed(() => this.layoutSignal.value);

  private fileSubject = new BehaviorSubject<File | null>(null);
  file$: Observable<File | null> = this.fileSubject.asObservable();
  private fileSignal = signal<File | null>(null);
  file = computed(() => this.fileSignal.value);

  private viewPaginationInfoSubject = new BehaviorSubject<{
    currentPage: number | null;
    totalPages: number | null;
  }>({ currentPage: null, totalPages: null });
  viewPaginationInfo$: Observable<{ currentPage: number | null; totalPages: number | null }> =
    this.viewPaginationInfoSubject.asObservable();
  private viewPaginationInfoSignal = signal<{
    currentPage: number;
    totalPages: number;
  }>({ currentPage: 1, totalPages: 1 });
  viewPaginationInfo = computed(() => this.viewPaginationInfoSignal.value);

  private errorsSubject = new BehaviorSubject<{ unexpected: Error | null; expected: Error | null }>(
    { unexpected: null, expected: null }
  );
  errors$: Observable<{ unexpected: Error | null; expected: Error | null }> =
    this.errorsSubject.asObservable();
  private errorsSignal = signal<{ unexpected: Error | null; expected: Error | null }>({
    unexpected: null,
    expected: null,
  });
  errors = computed(() => this.errorsSignal.value);

  private viewFilterSubject = new BehaviorSubject<RowFilter | null>(null);
  viewFilter$: Observable<RowFilter | null> = this.viewFilterSubject.asObservable();
  private viewFilterSignal = signal<RowFilter | null>(null);
  viewFilter = computed(() => this.viewFilterSignal.value);

  private currentRowsSubject = new BehaviorSubject<RowObject[] | null>(null);
  currentRows$: Observable<RowObject[] | null> = this.currentRowsSubject.asObservable();
  private currentRowsSignal = signal<RowObject[] | null>(null);
  currentRows = computed(() => this.currentRowsSignal.value);

  private currentErrorsSubject = new BehaviorSubject<ValidationError[] | null>(null);
  currentErrors$: Observable<ValidationError[] | null> = this.currentErrorsSubject.asObservable();
  private currentErrorsSignal = signal<ValidationError[] | null>(null);
  currentErrors = computed(() => this.currentErrorsSignal.value);

  private stepSubject = new BehaviorSubject<string[]>([]);
  step$: Observable<string[]> = this.stepSubject.asObservable();
  private stepSignal = signal<string[]>([]);
  step = computed(() => this.stepSignal.value);

  private notificationSubject = new BehaviorSubject<Notification | null>(null);
  notification$: Observable<Notification | null> = this.notificationSubject.asObservable();
  logs$!: Observable<Log>;

  private id!: string;
  private provider!: ProviderModule;
  private logger!: ILoggerModule;
  private actor!: ActorRefFrom<ReturnType<typeof createMachine>>;
  private machine!: ReturnType<typeof createMachine>;

  private subscriptions = new Subscription();

  initialize = (provider: ProviderModule, id?: string): void => {
    this.id = id ?? crypto.randomUUID();
    this.provider = provider;
    this.logger = this.provider.modules.logger;

    this.logs$ = this.logger.logs$;

    if (this.actor) return;

    const context: Partial<OrchestratorContext> = {};

    this.machine = mainStateMachine(context);

    this.actor = createActor(this.machine);

    const snapshot$: Observable<SnapshotFrom<typeof this.machine>> = from(this.actor);

    this.subscriptions.add(
      snapshot$
        .pipe(
          map((s) => (s.context as OrchestratorContext).layout),
          distinctUntilChanged(isEqual)
        )
        .subscribe((val) => {
          this.layoutSubject.next(val);
          this.layoutSignal.value = val;
        })
    );

    this.subscriptions.add(
      snapshot$
        .pipe(
          map((s) => s.value),
          distinctUntilChanged(isEqual)
        )
        .subscribe((val) => {
          this.stateSubject.next(val);
          this.stateSignal.value = val;
        })
    );

    this.subscriptions.add(
      snapshot$
        .pipe(
          map((s) => (s.context as OrchestratorContext).metrics),
          distinctUntilChanged(isEqual)
        )
        .subscribe((val) => {
          this.metricsSubject.next(val);
          this.metricsSignal.value = val;
        })
    );

    this.subscriptions.add(
      snapshot$
        .pipe(
          map((s) => (s.context as OrchestratorContext).progress),
          distinctUntilChanged(isEqual)
        )
        .subscribe((val) => {
          this.progressSubject.next(val);
          this.progressSignal.value = val;
        })
    );

    this.subscriptions.add(
      snapshot$
        .pipe(
          map((s) => (s.context as OrchestratorContext).file),
          distinctUntilChanged(isEqual)
        )
        .subscribe((val) => {
          this.fileSubject.next(val);
          this.fileSignal.value = val;
        })
    );

    this.subscriptions.add(
      snapshot$
        .pipe(
          map((s) => s.context as OrchestratorContext),
          distinctUntilChanged(isEqual)
        )
        .subscribe((val) => {
          this.viewPaginationInfoSubject.next({
            currentPage: val.viewPaginationInfo.currentPage,
            totalPages: val.viewPaginationInfo.totalPages,
          });
          this.viewPaginationInfoSignal.value = {
            currentPage: val.viewPaginationInfo.currentPage,
            totalPages: val.viewPaginationInfo.totalPages,
          };
        })
    );

    this.subscriptions.add(
      snapshot$
        .pipe(
          map((s) => (s.context as OrchestratorContext).currentRows),
          distinctUntilChanged(isEqual)
        )
        .subscribe((val) => {
          this.currentRowsSubject.next(val);
          this.currentRowsSignal.value = val;
        })
    );

    this.subscriptions.add(
      snapshot$
        .pipe(
          map((s) => (s.context as OrchestratorContext).viewPaginationInfo),
          distinctUntilChanged(isEqual)
        )
        .subscribe((val) => {
          this.viewPaginationInfoSubject.next(val);
          this.viewPaginationInfoSignal.value = val;
        })
    );

    this.subscriptions.add(
      snapshot$
        .pipe(
          map((s) => (s.context as OrchestratorContext).viewPaginationInfo.currentFilter),
          distinctUntilChanged(isEqual)
        )
        .subscribe((val) => {
          this.viewFilterSubject.next(val);
          this.viewFilterSignal.value = val;
        })
    );

    this.subscriptions.add(
      snapshot$
        .pipe(
          map((s) => (s.context as OrchestratorContext).errors),
          distinctUntilChanged(isEqual)
        )
        .subscribe((val) => {
          this.errorsSubject.next(val);
          this.errorsSignal.value = val;
        })
    );

    this.subscriptions.add(
      snapshot$
        .pipe(
          map((s) => (s.context as OrchestratorContext).step),
          distinctUntilChanged(isEqual)
        )
        .subscribe((val) => {
          this.stepSubject.next(val);
          this.stepSignal.value = val;
        })
    );
  };

  stop = () => {
    if (!this.actor) return;

    this.logger.log("Orchestrator stopping...", "info", "stop", this.id);

    this.actor.stop();
    this.subscriptions.unsubscribe();

    this.subscriptions = new Subscription();

    this.contextSubject.complete();
    this.stateSubject.complete();
    this.metricsSubject.complete();
    this.progressSubject.complete();
    this.fileSubject.complete();
    this.viewPaginationInfoSubject.complete();
    this.errorsSubject.complete();
    this.viewFilterSubject.complete();
    this.currentRowsSubject.complete();
    this.currentErrorsSubject.complete();

    this.logger.log("Orchestrator stopped", "info", "stop", this.id);
  };

  getId = (): string => {
    return this.id;
  };

  getCurrentState = (): string => {
    return this.stateSignal.value;
  };

  getCurrentContext = (): any => {
    return this.contextSignal.value;
  };

  getLogs = (
    fromTime?: Date,
    toTime?: Date,
    fromIndex?: number,
    toIndex?: number,
    level?: "info" | "warn" | "error" | "debug" | "success",
    step?: string,
    id?: string
  ): Log[] => {
    return this.logger!.getLogs(fromTime, toTime, fromIndex, toIndex, level, step, id);
  };

  reset = (): void => {
    this.actor!.send({ type: "RESET" } as ResetEvent);
  };
  selectFile = (file: File): void => {
    this.actor!.send({ type: "FILE_SELECTED", file } as FileSelectedEvent);
  };
  selectLayout = (layout: LayoutBase): void => {
    this.actor!.send({ type: "LAYOUT_SELECTED", layout } as LayoutSelectedEvent);
  };
  changeViewFilter = (filter: RowFilter | null): void => {
    this.actor!.send({ type: "CHANGE_FILTER", filter } as ChangeFilterEvent);
  };
  changeViewPage = (pageNumber: number): void => {
    this.actor!.send({ type: "CHANGE_PAGE", pageNumber } as ChangePageEvent);
  };
  removeRow = (rowId: number): void => {
    this.actor!.send({ type: "REMOVE_ROW", rowId } as RemoveRowEvent);
  };
  export = (id: string, target: "Stream" | "File"): void => {
    this.actor!.send({ type: "EXPORT", id, exportTarget: target } as ExportEvent);
  };
  editRow = (rowId: number, key: string, value: string): void => {
    this.actor!.send({ type: "EDIT_ROW", rowId, key, value } as EditRowEvent);
  };
  updateConfig = (module: string, options: any): void => {
    const currentState = this.actor!.getSnapshot();

    if (!currentState.matches("working.readingData.waitingLayout")) {
      throw new Error(`Cannot update config in state ${JSON.stringify(currentState.value)}`);
    }

    const moduleToConfig = this.provider!.modules![module as keyof ProviderModule["modules"]];
    if (moduleToConfig && "updateOptions" in moduleToConfig) {
      moduleToConfig.updateOptions(options);
    } else {
      throw new Error(`Module ${module} not found`);
    }
  };

  cleanPersistence = async (): Promise<void> => {
    await this.provider.modules!.persistence!.clear();
  };
}
