import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrchestatorModule } from './main';
import { ProviderModule } from '../provider/main';
import { ILoggerModule } from '../logger/i-logger-module';
import { LayoutBase } from '@/shared/schemes/layout-base';
import { BehaviorSubject } from 'rxjs';

describe('OrchestatorModule - XState Graph Integration', () => {
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
      updateMetrics: vi.fn().mockResolvedValue(undefined),
      deleteErrors: vi.fn().mockResolvedValue(undefined),
      getRowsStream: vi.fn().mockReturnValue(ReadableStream.prototype as any),
      getMetrics: vi.fn().mockResolvedValue({
        totalRows: 2,
        fileName: 'test',
        errorCount: 0,
        processedRows: 2,
      }),
    };

    const mockViewer = {
      getRowsWithPagination: vi.fn().mockResolvedValue({
        rows: [
          { _id: 1, col1: 'val1', col2: 'val2' },
          { _id: 2, col1: 'val3', col2: 'val4' },
        ],
        errors: [],
      }),
      editRow: vi.fn().mockResolvedValue(undefined),
      getTotalPages: vi.fn().mockReturnValue(1),
    };

    const mockImporter = {
      readFileStream: vi.fn().mockReturnValue([new ReadableStream(), 100]),
    };

    const mockStepsEngine = {
      handleStream: vi.fn().mockResolvedValue({
        metrics: { totalRows: 2, processedRows: 2, errorCount: 0 },
      }),
    };

    const mockGlobalStepsEngine = {
      handleStep: vi.fn().mockReturnValue(new ReadableStream()),
    };

    const mockExporter = {
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

  describe('Basic State Transitions', () => {
    it('should initialize and reach waiting-layout state', async () => {
      const orchestrator = new OrchestatorModule();
      orchestrator.initialize(mockProvider);

      await new Promise(resolve => setTimeout(resolve, 100));
      const state = orchestrator.getCurrentState();
      expect(['initializing', 'waiting-layout']).toContain(state);

      orchestrator.stop();
    }, 10000);

    it('should handle layout selection', async () => {
      const orchestrator = new OrchestatorModule();
      orchestrator.initialize(mockProvider);

      await new Promise(resolve => setTimeout(resolve, 150));
      orchestrator.selectLayout(mockLayout);

      await new Promise(resolve => setTimeout(resolve, 100));
      const context = orchestrator.getCurrentContext();
      expect(context.layout).toEqual(mockLayout);

      orchestrator.stop();
    }, 10000);

    it('should handle file selection', async () => {
      const orchestrator = new OrchestatorModule();
      orchestrator.initialize(mockProvider);

      await new Promise(resolve => setTimeout(resolve, 150));
      orchestrator.selectLayout(mockLayout);

      await new Promise(resolve => setTimeout(resolve, 100));
      orchestrator.selectFile(mockFile);

      await new Promise(resolve => setTimeout(resolve, 200));
      const context = orchestrator.getCurrentContext();
      expect(context.file).toEqual(mockFile);

      orchestrator.stop();
    }, 10000);
  });

  describe('Complex Workflows', () => {
    it('should handle multiple operations sequentially', async () => {
      const orchestrator = new OrchestatorModule();
      orchestrator.initialize(mockProvider);

      await new Promise(resolve => setTimeout(resolve, 150));
      orchestrator.selectLayout(mockLayout);

      await new Promise(resolve => setTimeout(resolve, 100));
      orchestrator.selectFile(mockFile);

      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify state is defined and context is populated
      const state = orchestrator.getCurrentState();
      const context = orchestrator.getCurrentContext();

      expect(state).toBeDefined();
      expect(context.file).toBe(mockFile);
      expect(context.layout).toBe(mockLayout);

      orchestrator.stop();
    }, 10000);

    it('should handle reset', async () => {
      const orchestrator = new OrchestatorModule();
      orchestrator.initialize(mockProvider);

      await new Promise(resolve => setTimeout(resolve, 150));
      orchestrator.selectLayout(mockLayout);

      await new Promise(resolve => setTimeout(resolve, 100));
      const contextBeforeReset = orchestrator.getCurrentContext();
      expect(contextBeforeReset.layout).toBe(mockLayout);

      orchestrator.reset();

      await new Promise(resolve => setTimeout(resolve, 150));
      const contextAfterReset = orchestrator.getCurrentContext();
      expect(contextAfterReset.layout).toBeNull();
      expect(contextAfterReset.file).toBeNull();

      orchestrator.stop();
    }, 10000);
  });

  describe('Observable Emission', () => {
    it('should emit state changes', async () => {
      const orchestrator = new OrchestatorModule();
      orchestrator.initialize(mockProvider);

      const emissions: string[] = [];

      orchestrator.state$.subscribe((state) => {
        emissions.push(state);
      });

      await new Promise(resolve => setTimeout(resolve, 300));

      orchestrator.stop();

      expect(emissions.length).toBeGreaterThan(0);
    }, 10000);

    it('should emit context changes', async () => {
      const orchestrator = new OrchestatorModule();
      orchestrator.initialize(mockProvider);

      const contextSnapshots: any[] = [];

      orchestrator.context$.subscribe((context) => {
        contextSnapshots.push(context);
      });

      await new Promise(resolve => setTimeout(resolve, 150));
      orchestrator.selectLayout(mockLayout);

      await new Promise(resolve => setTimeout(resolve, 100));

      orchestrator.stop();

      expect(contextSnapshots.length).toBeGreaterThan(0);
    }, 10000);
  });
});
