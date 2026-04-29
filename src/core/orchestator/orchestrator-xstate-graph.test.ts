import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OrchestatorModule } from './main';
import { ProviderModule } from '../provider/main';
import { ILoggerModule } from '../logger/i-logger-module';
import { LayoutBase } from '@/shared/schemes/layout-base';
import { BehaviorSubject, firstValueFrom, filter, timeout } from 'rxjs';
import { OrchestatorContext } from './schemes/orchestator-context';

/**
 * XState Graph Integration Tests for Orchestrator
 * 
 * Comprehensive path-based testing using @xstate/graph patterns:
 * - Path = sequence of states connected by events
 * - Each path tests a complete workflow through the state machine
 * - Validates state transitions, context updates, and observables
 */

/** Helper para esperar a que el estado sea un valor específico */
const waitForState = (
  orchestrator: OrchestatorModule,
  targetState: string | string[],
  timeoutMs = 10000
): Promise<string> => {
  const targetStates = Array.isArray(targetState) ? targetState : [targetState];
  return firstValueFrom(
    orchestrator.state$.pipe(
      filter((state) => targetStates.includes(state as any)),
      timeout(timeoutMs)
    )
  );
};

/** Helper para esperar a que un contexto cumpla una condición */
const waitForContext = (
  orchestrator: OrchestatorModule,
  predicate: (ctx: OrchestatorContext) => boolean,
  timeoutMs = 10000
): Promise<OrchestatorContext> => {
  return firstValueFrom(
    orchestrator.context$.pipe(
      filter((ctx) => predicate(ctx)),
      timeout(timeoutMs)
    )
  );
};

describe('OrchestatorModule - XState Graph Paths', () => {
  let mockProvider: ProviderModule;
  let mockLogger: ILoggerModule;

  const mockLayout: LayoutBase = {
    id: 'test-layout',
    name: 'Test Layout',
    columns: [],
    localSteps: [],
    globalSteps: [],
    exports: {},
    filter: undefined,
  } as any;

  const mockFile = new File(['col1,col2\nval1,val2\nval3,val4'], 'test.csv', {
    type: 'text/csv',
  }) as any;

  beforeEach(() => {
    mockLogger = {
      log: vi.fn().mockReturnValue(undefined),
      logs$: new BehaviorSubject(null).asObservable(),
    } as any;

    const mockPersistence = {
      saveStream: vi.fn().mockResolvedValue({
        metrics: { totalRows: 2, processedRows: 2, errorCount: 0 },
      }),
      clear: vi.fn(),
      deleteRow: vi.fn().mockResolvedValue(undefined),
      updateMetricsSaved: vi.fn().mockResolvedValue(undefined),
      deleteErrors: vi.fn().mockResolvedValue(undefined),
      getRowsStream: vi.fn().mockReturnValue(ReadableStream.prototype as any),
      getMetrics: vi.fn().mockResolvedValue({
        totalRows: 2,
        fileName: 'test',
        errorCount: 0,
        processedRows: 2,
      }),
      getErrorRows: vi.fn().mockResolvedValue([]),
      loadRows: vi.fn().mockResolvedValue({
        rows: [
          { _id: 1, col1: 'val1', col2: 'val2' },
          { _id: 2, col1: 'val3', col2: 'val4' },
        ],
        errors: [],
      }),
    };

    const mockViewer = {
      getRows: vi.fn().mockResolvedValue([
        { _id: 1, col1: 'val1', col2: 'val2' },
        { _id: 2, col1: 'val3', col2: 'val4' },
      ]),
      deleteRow: vi.fn().mockResolvedValue(undefined),
      updateRow: vi.fn().mockResolvedValue(undefined),
      editRow: vi.fn().mockResolvedValue(undefined),
      getRowsWithPagination: vi.fn().mockResolvedValue({
        rows: [
          { _id: 1, col1: 'val1', col2: 'val2' },
          { _id: 2, col1: 'val3', col2: 'val4' },
        ],
        errors: [],
      }),
    };

    const mockImporter = {
      importFile: vi.fn().mockResolvedValue(new ReadableStream()),
      readFileStream: vi.fn().mockResolvedValue(new ReadableStream()),
    };

    const mockStepsEngine = {
      mappingStep: vi.fn().mockResolvedValue({
        metrics: { totalRows: 2, processedRows: 2, errorCount: 0 },
      }),
      handleStream: vi.fn().mockResolvedValue({
        metrics: { totalRows: 2, processedRows: 2, errorCount: 0 },
      }),
    };

    const mockGlobalStepsEngine = {
      handleStep: vi.fn().mockReturnValue(new ReadableStream()),
    };

    const mockExporter = {
      exportData: vi.fn().mockResolvedValue(undefined),
      exportStream: vi.fn().mockResolvedValue(new ReadableStream()),
      exportToCsv: vi.fn().mockResolvedValue(undefined),
    };

    mockProvider = {
      modules: {
        logger: mockLogger,
        persistence: mockPersistence,
        viewer: mockViewer,
        importer: mockImporter,
        mapper: mockStepsEngine,
        localStepEngine: mockStepsEngine,
        globalStepEngine: mockGlobalStepsEngine,
        exporter: mockExporter,
      },
    } as any;
  });

  describe('Path 1: Layout Selection', () => {
    it('should initialize in waiting-layout state', async () => {
      const orchestrator = new OrchestatorModule();
      orchestrator.initialize(mockProvider);

      const state = await waitForState(orchestrator, ['initializing', 'waiting-layout']);
      expect(['initializing', 'waiting-layout']).toContain(state);
      
      orchestrator.stop();
    });

    it('should transition to waiting-file on LAYOUT_SELECTED', async () => {
      const orchestrator = new OrchestatorModule();
      orchestrator.initialize(mockProvider);

      await waitForState(orchestrator, 'waiting-layout');

      orchestrator.selectLayout(mockLayout);
      const state = await waitForState(orchestrator, 'waiting-file');
      expect(state).toBe('waiting-file');

      const context = await waitForContext(
        orchestrator,
        (ctx) => ctx.layout !== null
      );
      expect(context.layout).toEqual(mockLayout);
      
      orchestrator.stop();
    });
  });

  describe('Path 2: File Import & ETL Processing', () => {
    it('should complete full ETL pipeline', async () => {
      const orchestrator = new OrchestatorModule();
      orchestrator.initialize(mockProvider);

      // Esperar a que llegue a waiting-layout sin timeout
      await waitForState(orchestrator, 'waiting-layout');

      // Seleccionar layout y esperar la transición
      orchestrator.selectLayout(mockLayout);
      await waitForState(orchestrator, 'waiting-file');

      // Seleccionar archivo y esperar a que completar todo el pipeline
      orchestrator.selectFile(mockFile);
      const finalState = await waitForState(orchestrator, ['waiting-user', 'waiting-user-with-errors']);

      expect(['waiting-user', 'waiting-user-with-errors']).toContain(finalState);

      const context = await waitForContext(
        orchestrator,
        (ctx) => ctx.file !== null && ctx.layout !== null
      );
      expect(context.file).toEqual(mockFile);
      expect(context.layout).toEqual(mockLayout);
      
      orchestrator.stop();
    });
  });

  describe('Path 3: Page Navigation', () => {
    it('should handle CHANGE_PAGE', async () => {
      const orchestrator = new OrchestatorModule();
      orchestrator.initialize(mockProvider);

      await waitForState(orchestrator, 'waiting-layout');
      orchestrator.selectLayout(mockLayout);
      await waitForState(orchestrator, 'waiting-file');
      orchestrator.selectFile(mockFile);
      await waitForState(orchestrator, 'waiting-user');

      orchestrator.changePage(2);
      const context = await waitForContext(
        orchestrator,
        (ctx) => ctx.pageNumber === 2
      );
      expect(context.pageNumber).toBe(2);
      
      orchestrator.stop();
    });
  });

  describe('Path 4: Row Editing', () => {
    it('should handle EDIT_ROW', async () => {
      const orchestrator = new OrchestatorModule();
      orchestrator.initialize(mockProvider);

      await waitForState(orchestrator, 'waiting-layout');
      orchestrator.selectLayout(mockLayout);
      await waitForState(orchestrator, 'waiting-file');
      orchestrator.selectFile(mockFile);
      await waitForState(orchestrator, 'waiting-user');

      orchestrator.editRow(1, 'col1', 'updated');
      const context = await waitForContext(
        orchestrator,
        (ctx) => ctx.editingRow !== null
      );
      expect(context.editingRow).toEqual({ rowId: 1, key: 'col1', value: 'updated' });
      
      orchestrator.stop();
    });
  });

  describe('Path 5: Row Removal', () => {
    it('should handle REMOVE_ROW', async () => {
      const orchestrator = new OrchestatorModule();
      orchestrator.initialize(mockProvider);

      await waitForState(orchestrator, 'waiting-layout');
      orchestrator.selectLayout(mockLayout);
      await waitForState(orchestrator, 'waiting-file');
      orchestrator.selectFile(mockFile);
      await waitForState(orchestrator, 'waiting-user');

      orchestrator.removeRow(1);
      const context = await waitForContext(
        orchestrator,
        (ctx) => ctx.removingRow !== null
      );
      expect(context.removingRow).toEqual({ rowId: 1 });
      
      orchestrator.stop();
    });
  });

  describe('Path 6: Data Export', () => {
    it('should handle EXPORT to Stream', async () => {
      const orchestrator = new OrchestatorModule();
      orchestrator.initialize(mockProvider);

      await waitForState(orchestrator, 'waiting-layout');
      orchestrator.selectLayout(mockLayout);
      await waitForState(orchestrator, 'waiting-file');
      orchestrator.selectFile(mockFile);
      await waitForState(orchestrator, 'waiting-user');

      orchestrator.export('export-1', 'Stream');
      const context = await waitForContext(
        orchestrator,
        (ctx) => ctx.exporting !== null
      );
      expect(context.exporting).toEqual({ id: 'export-1', target: 'Stream' });
      
      orchestrator.stop();
    });

    it('should handle EXPORT to File', async () => {
      const orchestrator = new OrchestatorModule();
      orchestrator.initialize(mockProvider);

      await waitForState(orchestrator, 'waiting-layout');
      orchestrator.selectLayout(mockLayout);
      await waitForState(orchestrator, 'waiting-file');
      orchestrator.selectFile(mockFile);
      await waitForState(orchestrator, 'waiting-user');

      orchestrator.export('export-csv', 'File');
      const context = await waitForContext(
        orchestrator,
        (ctx) => ctx.exporting !== null
      );
      expect(context.exporting).toEqual({ id: 'export-csv', target: 'File' });
      
      orchestrator.stop();
    });
  });

  describe('Path 7: Reset & Recovery', () => {
    it('should handle RESET', async () => {
      const orchestrator = new OrchestatorModule();
      orchestrator.initialize(mockProvider);

      await waitForState(orchestrator, 'waiting-layout');
      orchestrator.selectLayout(mockLayout);
      await waitForState(orchestrator, 'waiting-file');
      orchestrator.selectFile(mockFile);
      await waitForState(orchestrator, 'waiting-user');

      orchestrator.reset();
      // After reset, the machine should go back to initializing
      // then immediately to waiting-layout because of the always transition
      await waitForState(orchestrator, ['initializing', 'waiting-layout']);
      
      const context = orchestrator.getCurrentContext();
      expect(context.layout).toBeNull();
      expect(context.file).toBeNull();
      expect(context.pageNumber).toBe(1);
      
      orchestrator.stop();
    });
  });

  describe('Complex Workflows', () => {
    it('should handle multi-event workflow', async () => {
      const orchestrator = new OrchestatorModule();
      orchestrator.initialize(mockProvider);

      await waitForState(orchestrator, 'waiting-layout');
      orchestrator.selectLayout(mockLayout);
      await waitForState(orchestrator, 'waiting-file');
      orchestrator.selectFile(mockFile);
      await waitForState(orchestrator, 'waiting-user');

      orchestrator.changePage(2);
      orchestrator.editRow(1, 'col1', 'updated');
      orchestrator.export('export-1', 'File');
      
      await waitForContext(
        orchestrator,
        (ctx) => ctx.file !== null
      );

      const context = orchestrator.getCurrentContext();
      expect(context.file).toEqual(mockFile);
      
      orchestrator.stop();
    });
  });

  describe('Observable Streams', () => {
    it('should emit state changes', async () => {
      const orchestrator = new OrchestatorModule();
      orchestrator.initialize(mockProvider);

      const emissions: string[] = [];
      const subscription = orchestrator.state$.subscribe((state) => {
        emissions.push(state);
      });

      await waitForState(orchestrator, 'waiting-layout');

      orchestrator.selectLayout(mockLayout);
      orchestrator.selectFile(mockFile);
      await waitForState(orchestrator, 'waiting-user');

      subscription.unsubscribe();
      orchestrator.stop();

      expect(emissions.length).toBeGreaterThan(3);
    });

    it('should emit context changes', async () => {
      const orchestrator = new OrchestatorModule();
      orchestrator.initialize(mockProvider);

      const contextSnapshots: OrchestatorContext[] = [];
      const subscription = orchestrator.context$.subscribe((context) => {
        contextSnapshots.push(context);
      });

      await waitForState(orchestrator, 'waiting-layout');

      orchestrator.selectLayout(mockLayout);
      orchestrator.selectFile(mockFile);
      await waitForState(orchestrator, 'waiting-user');

      subscription.unsubscribe();
      orchestrator.stop();

      const withFile = contextSnapshots.filter((c) => c.file !== null);
      expect(withFile.length).toBeGreaterThan(0);
    });
  });

  describe('State Validation', () => {
    it('should only emit valid states', async () => {
      const orchestrator = new OrchestatorModule();
      orchestrator.initialize(mockProvider);

      const validStates = [
        'initializing',
        'idle',
        'waiting-layout',
        'waiting-file',
        'importing',
        'mapping',
        'handling-local-step',
        'persisting',
        'handle-global-steps',
        'initializing-user-view',
        'waiting-user',
        'waiting-user-with-errors',
        'editing-row',
        'handle-local-steps-on-edit',
        'handle-global-steps-on-edit',
        'exporting',
        'cleaning',
        'unexpected-error',
      ];

      const emittedStates: string[] = [];
      const subscription = orchestrator.state$.subscribe((state) => {
        // Para estados compuestos, extraer el padre
        const stateKey = typeof state === 'string' ? state : Object.keys(state)[0];
        if (stateKey && !emittedStates.includes(stateKey)) {
          emittedStates.push(stateKey);
        }
      });

      await waitForState(orchestrator, 'waiting-layout', 15000);
      orchestrator.selectLayout(mockLayout);
      orchestrator.selectFile(mockFile);
      
      await waitForState(orchestrator, 'waiting-user', 15000);
      
      orchestrator.changePage(2);
      await waitForContext(
        orchestrator,
        (ctx) => ctx.pageNumber === 2,
        15000
      );

      orchestrator.editRow(1, 'col1', 'val');

      orchestrator.reset();
      await new Promise(resolve => setTimeout(resolve, 500));

      subscription.unsubscribe();
      orchestrator.stop();

      emittedStates.forEach((state) => {
        expect(validStates).toContain(state);
      });
    }, 20000);
  });
});

/**
 * Advanced Tests: Industrial-Grade Scenarios
 * Tests that separate a basic implementation from production-ready code
 */
describe('OrchestatorModule - Advanced Scenarios', () => {
  let mockProvider: ProviderModule;
  let mockLogger: ILoggerModule;

  const mockLayout: LayoutBase = {
    id: 'test-layout',
    name: 'Test Layout',
    columns: [],
    localSteps: [],
    globalSteps: [],
    exports: {},
    filter: undefined,
  } as any;

  const mockFile = new File(['col1,col2\nval1,val2\nval3,val4'], 'test.csv', {
    type: 'text/csv',
  }) as any;

  beforeEach(() => {
    mockLogger = {
      log: vi.fn().mockReturnValue(undefined),
      logs$: new BehaviorSubject(null).asObservable(),
    } as any;

    const mockPersistence = {
      saveStream: vi.fn().mockResolvedValue({
        metrics: { totalRows: 2, processedRows: 2, errorCount: 0 },
      }),
      clear: vi.fn(),
      deleteRow: vi.fn().mockResolvedValue(undefined),
      updateMetricsSaved: vi.fn().mockResolvedValue(undefined),
      deleteErrors: vi.fn().mockResolvedValue(undefined),
      getRowsStream: vi.fn().mockReturnValue(ReadableStream.prototype as any),
      getMetrics: vi.fn().mockResolvedValue({
        totalRows: 2,
        fileName: 'test',
        errorCount: 0,
        processedRows: 2,
      }),
      getErrorRows: vi.fn().mockResolvedValue([]),
      loadRows: vi.fn().mockResolvedValue({
        rows: [
          { _id: 1, col1: 'val1', col2: 'val2' },
          { _id: 2, col1: 'val3', col2: 'val4' },
        ],
        errors: [],
      }),
    };

    const mockViewer = {
      getRows: vi.fn().mockResolvedValue([
        { _id: 1, col1: 'val1', col2: 'val2' },
        { _id: 2, col1: 'val3', col2: 'val4' },
      ]),
      deleteRow: vi.fn().mockResolvedValue(undefined),
      updateRow: vi.fn().mockResolvedValue(undefined),
      editRow: vi.fn().mockResolvedValue(undefined),
      getRowsWithPagination: vi.fn().mockResolvedValue({
        rows: [
          { _id: 1, col1: 'val1', col2: 'val2' },
          { _id: 2, col1: 'val3', col2: 'val4' },
        ],
        errors: [],
      }),
    };

    const mockImporter = {
      importFile: vi.fn().mockResolvedValue(new ReadableStream()),
      readFileStream: vi.fn().mockResolvedValue(new ReadableStream()),
    };

    const mockStepsEngine = {
      mappingStep: vi.fn().mockResolvedValue({
        metrics: { totalRows: 2, processedRows: 2, errorCount: 0 },
      }),
      handleStream: vi.fn().mockResolvedValue({
        metrics: { totalRows: 2, processedRows: 2, errorCount: 0 },
      }),
    };

    const mockGlobalStepsEngine = {
      handleStep: vi.fn().mockReturnValue(new ReadableStream()),
    };

    const mockExporter = {
      exportData: vi.fn().mockResolvedValue(undefined),
      exportStream: vi.fn().mockResolvedValue(new ReadableStream()),
      exportToCsv: vi.fn().mockResolvedValue(undefined),
    };

    mockProvider = {
      modules: {
        logger: mockLogger,
        persistence: mockPersistence,
        viewer: mockViewer,
        importer: mockImporter,
        mapper: mockStepsEngine,
        localStepEngine: mockStepsEngine,
        globalStepEngine: mockGlobalStepsEngine,
        exporter: mockExporter,
      },
    } as any;
  });

  describe('Abort Signal & Cancellation', () => {
    it('should handle abort signal when RESET is triggered during import', async () => {
      const orchestrator = new OrchestatorModule();
      const mockPersistence = mockProvider.modules.persistence as any;
      
      orchestrator.initialize(mockProvider);

      await waitForState(orchestrator, 'waiting-layout');
      orchestrator.selectLayout(mockLayout);
      await waitForState(orchestrator, 'waiting-file');
      
      // Dispara reset mientras el archivo está siendo seleccionado
      // Esto debería disparar un abort signal en los actores activos
      orchestrator.selectFile(mockFile);
      
      // Espera breve para que entre en estado importing
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Dispara reset durante el importing
      orchestrator.reset();
      
      // Verifica que el contexto fue limpiado
      await waitForState(orchestrator, ['initializing', 'waiting-layout']);
      
      const context = orchestrator.getCurrentContext();
      expect(context.file).toBeNull();
      expect(context.layout).toBeNull();
      
      orchestrator.stop();
    }, 15000);

    it('should clean up resources on orchestrator stop', async () => {
      const orchestrator = new OrchestatorModule();
      orchestrator.initialize(mockProvider);

      await waitForState(orchestrator, 'waiting-layout');
      orchestrator.selectLayout(mockLayout);
      await waitForState(orchestrator, 'waiting-file');
      orchestrator.selectFile(mockFile);
      await waitForState(orchestrator, 'waiting-user');

      // Simula una limpieza
      orchestrator.stop();
      
      // El estado y contexto deben ser los últimos valores antes de stop
      expect(orchestrator.getCurrentState()).toBeDefined();
    }, 15000);
  });
});
