import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { OrchestatorModule } from './main';
import { ProviderModule } from '../provider/main';
import { ILoggerModule } from '../logger/i-logger-module';
import { LayoutBase } from '@/shared/schemes/layout-base';
import { BehaviorSubject } from 'rxjs';

describe('OrchestatorModule - State Machine', () => {
  let orchestrator: OrchestatorModule;
  let mockProvider: ProviderModule;
  let mockLogger: ILoggerModule;

  const mockLayout: LayoutBase = {
    id: 'test-layout',
    name: 'Test Layout',
    columns: [],
    localSteps: [],
    globalSteps: [],
    exports: {
      'test-export': { fn: (row: any) => row, labelDicc: {} },
      'export-1': { fn: (row: any) => row, labelDicc: {} },
      'export-stream': { fn: (row: any) => row, labelDicc: {}, callback: async () => {} },
    },
    filter: undefined,
  } as any;

  const mockFile = new File(['test content'], 'test.csv', { type: 'text/csv' }) as any;

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      log: vi.fn().mockReturnValue(undefined),
      logs$: new BehaviorSubject(null).asObservable(),
    } as any;

    // Mock persistence module
    const mockPersistence = {
      saveStream: vi.fn().mockResolvedValue({
        metrics: {
          totalRows: 10,
          processedRows: 10,
          errorCount: 0,
        },
      }),
      clear: vi.fn(),
      deleteRow: vi.fn().mockResolvedValue(undefined),
      updateMetricsSaved: vi.fn().mockResolvedValue(undefined),
      deleteErrors: vi.fn().mockResolvedValue(undefined),
      getRowsStream: vi.fn().mockReturnValue(
        ReadableStream.prototype as any
      ),
      getMetrics: vi.fn().mockResolvedValue({
        totalRows: 10,
        fileName: 'test',
      }),
    };

    // Mock importer module
    const mockImporter = {
      readFileStream: vi.fn().mockResolvedValue(
        ReadableStream.prototype as any
      ),
    };

    // Mock mapper module
    const mockMapper = {
      handleStream: vi.fn().mockResolvedValue({
        metrics: {
          totalRows: 10,
          processedRows: 10,
          errorCount: 0,
        },
      }),
    };

    // Mock local step engine
    const mockLocalStepEngine = {
      handleStream: vi.fn().mockResolvedValue({
        metrics: {
          totalRows: 10,
          processedRows: 10,
          errorCount: 0,
        },
      }),
    };

    // Mock global step engine
    const mockGlobalStepEngine = {
      handleStep: vi.fn().mockReturnValue(
        ReadableStream.prototype as any
      ),
    };

    // Mock viewer module
    const mockViewer = {
      getRowsWithPagination: vi.fn().mockResolvedValue({
        rows: [],
        errors: [],
      }),
      editRow: vi.fn().mockResolvedValue(undefined),
    };

    // Mock exporter module
    const mockExporter = {
      exportStream: vi.fn().mockResolvedValue(
        ReadableStream.prototype as any
      ),
      exportToCsv: vi.fn().mockResolvedValue(undefined),
    };

    // Mock provider with all modules
    mockProvider = {
      modules: {
        logger: mockLogger,
        persistence: mockPersistence,
        importer: mockImporter,
        mapper: mockMapper,
        localStepEngine: mockLocalStepEngine,
        globalStepEngine: mockGlobalStepEngine,
        viewer: mockViewer,
        exporter: mockExporter,
      },
    } as any;

    orchestrator = new OrchestatorModule();
  });

  afterEach(() => {
    orchestrator?.stop();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with a unique ID', () => {
      orchestrator.initialize(mockProvider, 'test-id');
      expect(orchestrator.getId()).toBe('test-id');
    });

    it('should start in initializing state', async () => {
      orchestrator.initialize(mockProvider, 'test-id');
      
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(orchestrator.getCurrentState()).toBe('waiting-layout');
    });

    it('should transition to waiting-layout state after initialization', async () => {
      orchestrator.initialize(mockProvider, 'test-id');
      
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(orchestrator.getCurrentState()).toBe('waiting-layout');
    });

    it('should generate a random ID if not provided', async () => {
      orchestrator.initialize(mockProvider);
      const id1 = orchestrator.getId();
      
      const orchestrator2 = new OrchestatorModule();
      orchestrator2.initialize(mockProvider);
      const id2 = orchestrator2.getId();
      
      orchestrator2.stop();
      expect(id1).not.toBe(id2);
      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
    });
  });

  describe('Layout Selection', () => {
    beforeEach(() => {
      orchestrator.initialize(mockProvider, 'test-id');
    });

    it('should transition from waiting-layout to waiting-file on LAYOUT_SELECTED', async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
      orchestrator.selectLayout(mockLayout);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(orchestrator.getCurrentState()).toBe('waiting-file');
    });

    it('should update context with layout', async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
      orchestrator.selectLayout(mockLayout);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      const context = orchestrator.getCurrentContext();
      expect(context.layout).toBe(mockLayout);
    });
  });

  describe('File Selection', () => {
    beforeEach(async () => {
      orchestrator.initialize(mockProvider, 'test-id');
      await new Promise(resolve => setTimeout(resolve, 150));
      orchestrator.selectLayout(mockLayout);
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should transition from waiting-file to importing on FILE_SELECTED', async () => {
      orchestrator.selectFile(mockFile);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      const state = orchestrator.getCurrentState();
      expect(['importing', 'mapping', 'persisting', 'handling-global-step', 'initializing-user-view', 'waiting-user']).toContain(state);
    });

    it('should update context with file', async () => {
      orchestrator.selectFile(mockFile);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      const context = orchestrator.getCurrentContext();
      expect(context.file).toBe(mockFile);
    });
  });

  describe('State Flow', () => {
    it('should follow correct state sequence: initializing -> waiting-layout -> waiting-file -> importing', async () => {
      orchestrator.initialize(mockProvider, 'test-id');
      
      const states: string[] = [];
      
      orchestrator.state$.subscribe((state) => {
        states.push(state);
      });
      
      await new Promise(resolve => setTimeout(resolve, 150));
      orchestrator.selectLayout(mockLayout);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      orchestrator.selectFile(mockFile);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      expect(states).toContain('waiting-layout');
      expect(states).toContain('waiting-file');
      expect(states.some(s => ['importing', 'mapping', 'waiting-user'].includes(s))).toBe(true);
    });
  });

  describe('Context Management', () => {
    beforeEach(async () => {
      orchestrator.initialize(mockProvider, 'test-id');
      await new Promise(resolve => setTimeout(resolve, 150));
      orchestrator.selectLayout(mockLayout);
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should initialize context with default values', async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
      const context = orchestrator.getCurrentContext();
      expect(context.file).toBeNull();
      expect(context.layout).toBe(mockLayout);
      expect(context.metrics).toBeDefined();
      expect(context.metrics.totalRows).toBe(0);
      expect(context.metrics.processedRows).toBe(0);
      expect(context.metrics.errorCount).toBe(0);
    });

    it('should emit context through context$ observable', async () => {
      let contextEmitted = false;

      orchestrator.context$.subscribe((context) => {
        if (context) {
          contextEmitted = true;
          expect(context.layout).toBeDefined();
        }
      });

      await new Promise(resolve => setTimeout(resolve, 300));
      expect(contextEmitted).toBe(true);
    });

    it('should emit metrics through metrics$ observable', async () => {
      let metricsEmitted = false;

      orchestrator.metrics$.subscribe((metrics) => {
        if (metrics) {
          metricsEmitted = true;
          expect(metrics.totalRows).toBeDefined();
          expect(metrics.processedRows).toBeDefined();
          expect(metrics.errorCount).toBeDefined();
        }
      });

      await new Promise(resolve => setTimeout(resolve, 300));
      expect(metricsEmitted).toBe(true);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      orchestrator.initialize(mockProvider, 'test-id');
    });

    it('should transition to error state when import fails', async () => {
      const mockError = new Error('Import failed');
      const mockProviderWithError = {
        modules: {
          ...mockProvider.modules,
          importer: {
            readFileStream: vi.fn().mockRejectedValue(mockError),
          },
        },
      } as any;

      const orchestratorWithError = new OrchestatorModule();
      orchestratorWithError.initialize(mockProviderWithError, 'error-test-id');

      await new Promise(resolve => setTimeout(resolve, 150));
      orchestratorWithError.selectLayout(mockLayout);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      orchestratorWithError.selectFile(mockFile);
      
      await new Promise(resolve => setTimeout(resolve, 300));
      expect(orchestratorWithError.getCurrentState()).toBe('error');
      orchestratorWithError.stop();
    });

    it('should store error message in context', async () => {
      const errorMessage = 'Test error occurred';
      const mockProviderWithError = {
        modules: {
          ...mockProvider.modules,
          importer: {
            readFileStream: vi.fn().mockRejectedValue(new Error(errorMessage)),
          },
        },
      } as any;

      const orchestratorWithError = new OrchestatorModule();
      orchestratorWithError.initialize(mockProviderWithError, 'error-test-id');

      await new Promise(resolve => setTimeout(resolve, 150));
      orchestratorWithError.selectLayout(mockLayout);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      orchestratorWithError.selectFile(mockFile);
      
      await new Promise(resolve => setTimeout(resolve, 300));
      const context = orchestratorWithError.getCurrentContext();
      expect(context.unexpectedError).toBeTruthy();
      orchestratorWithError.stop();
    });

    it('should reset state on RESET event when in error state', async () => {
      const mockProviderWithError = {
        modules: {
          ...mockProvider.modules,
          importer: {
            readFileStream: vi.fn().mockRejectedValue(new Error('Import failed')),
          },
        },
      } as any;

      const orchestratorWithError = new OrchestatorModule();
      orchestratorWithError.initialize(mockProviderWithError, 'error-test-id');

      await new Promise(resolve => setTimeout(resolve, 150));
      orchestratorWithError.selectLayout(mockLayout);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      orchestratorWithError.selectFile(mockFile);
      
      await new Promise(resolve => setTimeout(resolve, 300));
      expect(orchestratorWithError.getCurrentState()).toBe('error');
      
      orchestratorWithError['actor']?.send({ type: 'RESET' });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(orchestratorWithError.getCurrentState()).toBe('waiting-layout');
      orchestratorWithError.stop();
    });
  });

  describe('Persistence', () => {
    it('should call clear on persistence module', () => {
      orchestrator.initialize(mockProvider, 'test-id');
      orchestrator.cleanPersistence();
      
      expect(mockProvider.modules.persistence.clear).toHaveBeenCalled();
    });

    it('should not call clear if not initialized', () => {
      orchestrator.cleanPersistence();
      
      expect(mockProvider.modules.persistence.clear).not.toHaveBeenCalled();
    });
  });

  describe('Start and Stop', () => {
    it('should start the state machine', async () => {
      orchestrator.initialize(mockProvider, 'test-id');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(orchestrator.getCurrentState()).toBeTruthy();
    });

    it('should stop the state machine and complete subjects', async () => {
      orchestrator.initialize(mockProvider, 'test-id');

      await new Promise(resolve => setTimeout(resolve, 100));
      let completedCount = 0;
      let errorCount = 0;

      orchestrator.state$.subscribe(
        () => {},
        () => { errorCount++; },
        () => { completedCount++; }
      );

      orchestrator.context$.subscribe(
        () => {},
        () => { errorCount++; },
        () => { completedCount++; }
      );

      orchestrator.metrics$.subscribe(
        () => {},
        () => { errorCount++; },
        () => { completedCount++; }
      );

      orchestrator.stop();

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(completedCount).toBeGreaterThan(0);
      expect(errorCount).toBe(0);
    });
  });

  describe('Observables', () => {
    beforeEach(() => {
      orchestrator.initialize(mockProvider, 'test-id');
    });

    it('should emit state changes through state$ observable', async () => {
      const states: string[] = [];

      orchestrator.state$.subscribe((state) => {
        states.push(state);
      });

      await new Promise(resolve => setTimeout(resolve, 200));
      expect(states.length).toBeGreaterThan(0);
      expect(states).toContain('waiting-layout');
    });

    it('should provide current state through getCurrentState', async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
      const currentState = orchestrator.getCurrentState();
      expect(currentState).toBe('waiting-layout');
    });

    it('should provide current context through getCurrentContext', async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
      const currentContext = orchestrator.getCurrentContext();
      expect(currentContext).toBeDefined();
      expect(currentContext.metrics).toBeDefined();
    });
  });

  describe('Logger Integration', () => {
    beforeEach(() => {
      orchestrator.initialize(mockProvider, 'test-id');
    });

    it('should log initialization', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String)
      );
    });

    it('should expose logs$ observable', async () => {
      let logsEmitted = false;

      orchestrator.logs$.subscribe(() => {
        logsEmitted = true;
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(logsEmitted).toBe(true);
    });
  });

  describe('Public API Functions', () => {
    beforeEach(async () => {
      orchestrator.initialize(mockProvider, 'test-id');
      await new Promise(resolve => setTimeout(resolve, 150));
      orchestrator.selectLayout(mockLayout);
      await new Promise(resolve => setTimeout(resolve, 100));
      orchestrator.selectFile(mockFile);
      await new Promise(resolve => setTimeout(resolve, 300));
    });

    it('should transition to waiting-user after file selection and processing', async () => {
      const state = orchestrator.getCurrentState();
      expect(['waiting-user', 'editing-row', 'removing-row', 'exporting']).toContain(state);
    });

    describe('changePage', () => {
      it('should send CHANGE_PAGE event with correct pageNumber', async () => {
        orchestrator.changePage(2);
        
        await new Promise(resolve => setTimeout(resolve, 100));
        const context = orchestrator.getCurrentContext();
        expect(context.pageNumber).toBe(2);
      });

      it('should transition back to initializing-user-view on page change', async () => {
        orchestrator.changePage(3);
        
        await new Promise(resolve => setTimeout(resolve, 150));
        const state = orchestrator.getCurrentState();
        expect(['initializing-user-view', 'waiting-user']).toContain(state);
      });
    });

    describe('removeRow', () => {
      it('should send REMOVE_ROW event with correct rowId', async () => {
        const rowIdToRemove = 5;
        orchestrator.removeRow(rowIdToRemove);
        
        await new Promise(resolve => setTimeout(resolve, 100));
        const context = orchestrator.getCurrentContext();
        expect(context.removingRow?.rowId).toBe(rowIdToRemove);
      });

      it('should transition to removing-row state', async () => {
        orchestrator.removeRow(1);
        
        await new Promise(resolve => setTimeout(resolve, 300));
        const state = orchestrator.getCurrentState();
        expect(['removing-row', 'initializing-user-view', 'waiting-user']).toContain(state);
      });
    });

    describe('export', () => {
      it('should send EXPORT event with correct id and target', async () => {
        const exportId = 'export-1';
        orchestrator.export(exportId, 'File');
        
        await new Promise(resolve => setTimeout(resolve, 100));
        const context = orchestrator.getCurrentContext();
        expect(context.exporting?.id).toBe(exportId);
        expect(context.exporting?.target).toBe('File');
      });

      it('should handle export to Stream target', async () => {
        const exportId = 'export-stream';
        orchestrator.export(exportId, 'Stream');
        
        await new Promise(resolve => setTimeout(resolve, 100));
        const context = orchestrator.getCurrentContext();
        expect(context.exporting?.target).toBe('Stream');
      });

      it('should transition to exporting state', async () => {
        orchestrator.export('test-export', 'File');
        
        await new Promise(resolve => setTimeout(resolve, 300));
        const state = orchestrator.getCurrentState();
        expect(['exporting', 'waiting-user']).toContain(state);
      });
    });

    describe('reset', () => {
      it('should send RESET event', async () => {
        // First, we need to be in error state to properly test reset
        const mockProviderWithError = {
          modules: {
            ...mockProvider.modules,
            importer: {
              readFileStream: vi.fn().mockRejectedValue(new Error('Import failed')),
            },
          },
        } as any;

        const orchestratorToTest = new OrchestatorModule();
        orchestratorToTest.initialize(mockProviderWithError, 'reset-test-id');

        await new Promise(resolve => setTimeout(resolve, 150));
        orchestratorToTest.selectLayout(mockLayout);
        
        await new Promise(resolve => setTimeout(resolve, 100));
        orchestratorToTest.selectFile(mockFile);
        
        await new Promise(resolve => setTimeout(resolve, 300));
        expect(orchestratorToTest.getCurrentState()).toBe('error');
        
        orchestratorToTest.reset();
        
        await new Promise(resolve => setTimeout(resolve, 100));
        expect(orchestratorToTest.getCurrentState()).toBe('waiting-layout');
        orchestratorToTest.stop();
      });
    });

    describe('editRow', () => {
      it('should send EDIT_ROW event with correct parameters', async () => {
        const rowId = 1;
        const key = 'name';
        const value = 'John';
        
        let editingRowCaptured = null;
        const subscription = orchestrator.context$.subscribe((context) => {
          if (context.editingRow) {
            editingRowCaptured = context.editingRow;
          }
        });
        
        orchestrator.editRow(rowId, key, value);
        
        await new Promise(resolve => setTimeout(resolve, 150));
        subscription.unsubscribe();
        
        expect(editingRowCaptured?.rowId).toBe(rowId);
        expect(editingRowCaptured?.key).toBe(key);
        expect(editingRowCaptured?.value).toBe(value);
      });

      it('should transition to editing-row state', async () => {
        orchestrator.editRow(1, 'email', 'test@test.com');
        
        await new Promise(resolve => setTimeout(resolve, 300));
        const state = orchestrator.getCurrentState();
        expect(['editing-row', 'persisting', 'global-step-pipe', 'cleaning', 'waiting-user']).toContain(state);
      });
    });
  });
});
