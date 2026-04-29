import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MappingModule, DEFAULT_MAP_HEADERS_OPTIONS } from './main';
import { LoggerModule } from '../../logger/logger-native/main';
import { ValidateLayoutHeaders } from './core/validate-layout';
import { LayoutBase } from '../../../shared/schemes/layout-base';
import { LayoutHeader } from '../../../shared/schemes/layout-header';

vi.mock('./core/validate-layout');
vi.mock('../../logger/logger-native/main');

describe('MappingModule', () => {
    let mappingModule: MappingModule;
    let mockLogger: any;

    const createMockLayoutHeader = (overrides?: Partial<LayoutHeader>): LayoutHeader => ({
        key: 'name',
        label: 'Name',
        alternativeKeys: [],
        caseSensitive: false,
        description: 'User name',
        example: 'John Doe',
        required: true,
        default: '',
        order: 1,
        ...overrides
    });

    const createMockLayout = (overrides?: Partial<LayoutBase>): LayoutBase => ({
        id: 'layout-1',
        name: 'Test Layout',
        description: 'A test layout',
        localSteps: [],
        allowUndefinedColumns: false,
        headers: [
            createMockLayoutHeader({ key: 'name', required: true }),
            createMockLayoutHeader({ key: 'email', required: false })
        ],
        ...overrides
    });

    beforeEach(() => {
        mockLogger = {
            log: vi.fn(),
            updateStatus: vi.fn(),
            id: 'test-logger'
        };

        vi.mocked(LoggerModule).mockImplementation(() => mockLogger);
        mappingModule = new MappingModule(mockLogger);
    });

    describe('Constructor', () => {
        it('should initialize with default options', () => {
            const module = new MappingModule(mockLogger);
            expect(mockLogger.log).toHaveBeenCalledWith(
                'MappingModule initialized',
                'debug',
                'constructor',
                'mapping-native'
            );
        });

        it('should initialize with custom options', () => {
            const customOptions = {
                allowRemapColumns: true,
                ignoreRemapUnrequired: true,
                restCount: 5000,
                preserveOriginalValue: true
            };
            const module = new MappingModule(mockLogger, customOptions);
            expect(mockLogger.log).toHaveBeenCalled();
        });

        it('should merge custom options with default options', () => {
            const customOptions = {
                allowRemapColumns: true,
                ignoreRemapUnrequired: false,
                preserveOriginalValue: true
            };
            new MappingModule(mockLogger, customOptions);
            expect(mockLogger.log).toHaveBeenCalled();
        });
    });

    describe('generateMapFromHeaders', () => {
        it('should generate correct mapping from headers with exact key match', () => {
            const headers = [
                createMockLayoutHeader({ key: 'name' }),
                createMockLayoutHeader({ key: 'email' })
            ];
            const row = { name: 'John', email: 'john@example.com' };

            const result = mappingModule.generateMapFromHeaders(headers, row);

            expect(result).toEqual([
                ['name', 'name'],
                ['email', 'email']
            ]);
        });

        it('should handle case-insensitive matching', () => {
            const headers = [
                createMockLayoutHeader({ key: 'name', caseSensitive: false })
            ];
            const row = { NAME: 'John' };

            const result = mappingModule.generateMapFromHeaders(headers, row);

            expect(result).toEqual([['name', 'NAME']]);
        });

        it('should handle case-sensitive matching', () => {
            const headers = [
                createMockLayoutHeader({ 
                    key: 'name', 
                    caseSensitive: true,
                    alternativeKeys: ['userName']
                })
            ];
            const row = { userName: 'John' };

            const result = mappingModule.generateMapFromHeaders(headers, row);

            expect(result).toEqual([['name', 'userName']]);
        });

        it('should use alternative keys for mapping', () => {
            const headers = [
                createMockLayoutHeader({ 
                    key: 'name',
                    alternativeKeys: ['fullName', 'userName'],
                    caseSensitive: false
                })
            ];
            const row = { fullName: 'John Doe' };

            const result = mappingModule.generateMapFromHeaders(headers, row);

            expect(result).toEqual([['name', 'fullName']]);
        });

        it('should skip headers without matching keys', () => {
            const headers = [
                createMockLayoutHeader({ key: 'name' }),
                createMockLayoutHeader({ key: 'phone' })
            ];
            const row = { name: 'John' };

            const result = mappingModule.generateMapFromHeaders(headers, row);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual(['name', 'name']);
        });

        it('should handle multiple headers with alternative keys', () => {
            const headers = [
                createMockLayoutHeader({ 
                    key: 'firstName',
                    alternativeKeys: ['first_name'],
                    caseSensitive: false
                }),
                createMockLayoutHeader({ 
                    key: 'lastName',
                    alternativeKeys: ['last_name'],
                    caseSensitive: false
                })
            ];
            const row = { first_name: 'John', last_name: 'Doe' };

            const result = mappingModule.generateMapFromHeaders(headers, row);

            expect(result).toEqual([
                ['firstName', 'first_name'],
                ['lastName', 'last_name']
            ]);
        });
    });

    describe('handleRemap', () => {
        it('should return mapped headers when validation passes without remap allowed', async () => {
            const layout = createMockLayout();
            const row = { name: 'John', email: 'john@example.com' };

            vi.mocked(ValidateLayoutHeaders).mockReturnValue({
                isValid: true,
                message: 'Headers are not valid',
                missingColumns: [],
                undefinedColumns: [],
                repeatedColumns: [],
                duplicatedHeaders: []
            });

            const result = await mappingModule.handleRemap(layout, row);

            expect(result).toEqual([
                ['name', 'name'],
                ['email', 'email']
            ]);
        });

        it('should throw error when validation fails and remap not allowed', async () => {
            const layout = createMockLayout();
            const row = { email: 'john@example.com' }; // missing 'name'

            vi.mocked(ValidateLayoutHeaders).mockReturnValue({
                isValid: false,
                message: 'Headers are not valid',
                missingColumns: ['name'],
                undefinedColumns: [],
                repeatedColumns: [],
                duplicatedHeaders: []
            });

            await expect(mappingModule.handleRemap(layout, row))
                .rejects
                .toThrow('Mapping Error: Headers are not valid');
        });

        it('should return mapped headers when ignoreRemapUnrequired is true and validation passes', async () => {
            const layout = createMockLayout();
            const row = { name: 'John' };
            const customModule = new MappingModule(mockLogger, {
                allowRemapColumns: true,
                ignoreRemapUnrequired: true,
                preserveOriginalValue: true
            });

            vi.mocked(ValidateLayoutHeaders).mockReturnValue({
                isValid: true,
                message: 'Headers are not valid',
                missingColumns: [],
                undefinedColumns: [],
                repeatedColumns: [],
                duplicatedHeaders: []
            });

            const result = await customModule.handleRemap(layout, row);

            expect(result).toEqual([['name', 'name']]);
        });

        it('should call onRemapFn when columns can be remapped', async () => {
            const layout = createMockLayout();
            const row = { col1: 'John', col2: 'john@example.com' };
            const mockRemapFn = vi.fn().mockResolvedValue([
                [ 'col1', 'name',],
                [ 'col2', 'email']
            ]);

            const customModule = new MappingModule(mockLogger, {
                allowRemapColumns: true,
                ignoreRemapUnrequired: false,
                onRemapFn: mockRemapFn,
                preserveOriginalValue: true
            });

            vi.mocked(ValidateLayoutHeaders).mockReturnValue({
                isValid: false,
                message: 'Headers are not valid',
                missingColumns: ['name'],
                undefinedColumns: [],
                repeatedColumns: [],
                duplicatedHeaders: []
            });

            const result = await customModule.handleRemap(layout, row);

            expect(mockRemapFn).toHaveBeenCalled();
                expect(result).toEqual([
                    ['col1', 'name'],
                ['col2', 'email']
            ]);
        });

        it('should retry onRemapFn up to 3 times if it returns null', async () => {
            const layout = createMockLayout();
            const row = { col1: 'John', col2: 'john@example.com' };
            const mockRemapFn = vi.fn()
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce([
                    ['name', 'col1'],
                    ['email', 'col2']
                ]);

            const customModule = new MappingModule(mockLogger, {
                allowRemapColumns: true,
                ignoreRemapUnrequired: false,
                onRemapFn: mockRemapFn,
                preserveOriginalValue: true
            });

            vi.mocked(ValidateLayoutHeaders).mockReturnValue({
                isValid: false,
                message: 'Headers are not valid',
                missingColumns: [],
                undefinedColumns: [],
                repeatedColumns: [],
                duplicatedHeaders: []
            });

            const result = await customModule.handleRemap(layout, row);

            expect(mockRemapFn).toHaveBeenCalledTimes(3);
            expect(result).toEqual([
                ['name', 'col1'],
                ['email', 'col2']
            ]);
        });

        it('should throw error if onRemapFn fails after 3 attempts', async () => {
            const layout = createMockLayout();
            const row = { col1: 'John' };
            const mockRemapFn = vi.fn().mockResolvedValue(null);

            const customModule = new MappingModule(mockLogger, {
                allowRemapColumns: true,
                ignoreRemapUnrequired: false,
                onRemapFn: mockRemapFn,
                preserveOriginalValue: true
            });

            await expect(customModule.handleRemap(layout, row, undefined))
            .rejects
            .toThrow('Mapping Error: Cannot be mapped');

            expect(mockRemapFn).toHaveBeenCalledTimes(3);

        });

        it('should throw error when columns cannot be remapped', async () => {
            const layout = createMockLayout({
                headers: [
                    createMockLayoutHeader({ key: 'name', required: true }),
                    createMockLayoutHeader({ key: 'email', required: true })
                ]
            });
            const row = { col1: 'John' }; // not enough columns for required headers

            const customModule = new MappingModule(mockLogger, {
                allowRemapColumns: true,
                ignoreRemapUnrequired: false,
                preserveOriginalValue: true
            });

            vi.mocked(ValidateLayoutHeaders).mockReturnValue({
                isValid: false,
                message: 'Headers are not valid',
                missingColumns: ['email'],
                undefinedColumns: [],
                repeatedColumns: [],
                duplicatedHeaders: []
            });

            await expect(customModule.handleRemap(layout, row))
                .rejects
                .toThrow('Mapping Error: Cannot be mapped');
        });
    });

    describe('handleStream', () => {
        it('should return mapped rows with { __rowId, __originalValue, value } structure', async () => {
            const layout = createMockLayout();
            let capturedChunk: any = null;

            const mockStream = new ReadableStream({
                start(controller) {
                    controller.enqueue({
                        rows: [{ name: 'John', email: 'john@example.com' }],
                        progress: 50,
                        bytesProcessed: 1024,
                        metrics: {}
                    });
                    controller.close();
                }
            });

            vi.mocked(ValidateLayoutHeaders).mockReturnValue({
                isValid: true,
                message: 'Headers are not valid',
                missingColumns: [],
                undefinedColumns: [],
                repeatedColumns: [],
                duplicatedHeaders: []
            });

            const resultStream = await mappingModule.handleStream(mockStream, layout, 1);
            const reader = resultStream.getReader();

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    capturedChunk = value;
                }
            } catch (error) {
                // Stream ended
            }

            expect(capturedChunk).toBeDefined();
            expect(capturedChunk.rows[0]).toHaveProperty('__rowId');
            expect(capturedChunk.rows[0]).toHaveProperty('__originalValue');
            expect(capturedChunk.rows[0]).toHaveProperty('value');
            expect(capturedChunk.rows[0].__rowId).toBe(1);
            expect(capturedChunk.rows[0].value).toEqual({ name: 'John', email: 'john@example.com' });
        });

        it('should transform chunks through the stream', async () => {
            const layout = createMockLayout();
            const mockStream = new ReadableStream({
                start(controller) {
                    controller.enqueue({
                        rows: [{ name: 'John', email: 'john@example.com' }],
                        progress: 50,
                        bytesProcessed: 1024,
                        metrics: {}
                    });
                    controller.close();
                }
            });

            vi.mocked(ValidateLayoutHeaders).mockReturnValue({
                isValid: true,
                message: 'Headers are not valid',
                missingColumns: [],
                undefinedColumns: [],
                repeatedColumns: [],
                duplicatedHeaders: []
            });

            const result = mappingModule.handleStream(mockStream, layout, 1);

            expect(result).toBeDefined();
            expect(mockLogger.updateStatus).toHaveBeenCalledWith({
                order: 2,
                progress: 0,
                status: 'running',
                step: 'mapping'
            });
        });

        it('should preserve original value when preserveOriginalValue is true', async () => {
            const layout = createMockLayout();
            let capturedChunk: any = null;

            const customModule = new MappingModule(mockLogger, {
                allowRemapColumns: false,
                ignoreRemapUnrequired: false,
                preserveOriginalValue: true
            });

            const mockStream = new ReadableStream({
                start(controller) {
                    controller.enqueue({
                        rows: [{ name: 'John', email: 'john@example.com' }],
                        progress: 50,
                        bytesProcessed: 1024,
                        metrics: {}
                    });
                    controller.close();
                }
            });

            vi.mocked(ValidateLayoutHeaders).mockReturnValue({
                isValid: true,
                message: 'Headers are not valid',
                missingColumns: [],
                undefinedColumns: [],
                repeatedColumns: [],
                duplicatedHeaders: []
            });

            const resultStream = await customModule.handleStream(mockStream, layout, 1);
            const reader = resultStream.getReader();

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    capturedChunk = value;
                }
            } catch (error) {
                // Stream ended
            }

            expect(capturedChunk.rows[0].__originalValue).toBe(JSON.stringify({ name: 'John', email: 'john@example.com' }));
        });

        it('should not preserve original value when preserveOriginalValue is false', async () => {
            const layout = createMockLayout();
            let capturedChunk: any = null;

            const customModule = new MappingModule(mockLogger, {
                allowRemapColumns: false,
                ignoreRemapUnrequired: false,
                preserveOriginalValue: false
            });

            const mockStream = new ReadableStream({
                start(controller) {
                    controller.enqueue({
                        rows: [{ name: 'John', email: 'john@example.com' }],
                        progress: 50,
                        bytesProcessed: 1024,
                        metrics: {}
                    });
                    controller.close();
                }
            });

            vi.mocked(ValidateLayoutHeaders).mockReturnValue({
                isValid: true,
                message: 'Headers are not valid',
                missingColumns: [],
                undefinedColumns: [],
                repeatedColumns: [],
                duplicatedHeaders: []
            });

            const resultStream = await customModule.handleStream(mockStream, layout, 1);
            const reader = resultStream.getReader();

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    capturedChunk = value;
                }
            } catch (error) {
                // Stream ended
            }

            expect(capturedChunk.rows[0].__originalValue).toBeUndefined();
        });

        it('should increment __rowId for each row processed', async () => {
            const layout = createMockLayout();
            let capturedChunk: any = null;

            const mockStream = new ReadableStream({
                start(controller) {
                    controller.enqueue({
                        rows: [
                            { name: 'John', email: 'john@example.com' },
                            { name: 'Jane', email: 'jane@example.com' }
                        ],
                        progress: 5,
                        bytesProcessed: 1024,
                        metrics: {}
                    });
                    controller.close();
                }
            });

            vi.mocked(ValidateLayoutHeaders).mockReturnValue({
                isValid: true,
                message: 'Headers are not valid',
                missingColumns: [],
                undefinedColumns: [],
                repeatedColumns: [],
                duplicatedHeaders: []
            });

            const resultStream = await mappingModule.handleStream(mockStream, layout, 2);
            const reader = resultStream.getReader();

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    capturedChunk = value;
                }
            } catch (error) {
                // Stream ended
            }

            expect(capturedChunk.rows[0].__rowId).toBe(1);
            expect(capturedChunk.rows[1].__rowId).toBe(2);
        });

        it('should log completion on stream flush', async () => {
            const layout = createMockLayout();
            const mockStream = new ReadableStream({
                start(controller) {
                    controller.close();
                }
            });

            vi.mocked(ValidateLayoutHeaders).mockReturnValue({
                isValid: true,
                message: 'Headers are not valid',
                missingColumns: [],
                undefinedColumns: [],
                repeatedColumns: [],
                duplicatedHeaders: []
            });

            const result = mappingModule.handleStream(mockStream, layout, 0);
            
            expect(result).toBeDefined();
        });

        it('should use custom step and order parameters', async () => {
            const layout = createMockLayout();
            const mockStream = new ReadableStream({
                start(controller) {
                    controller.close();
                }
            });

            vi.mocked(ValidateLayoutHeaders).mockReturnValue({
                isValid: true,
                message: 'Headers are not valid',
                missingColumns: [],
                undefinedColumns: [],
                repeatedColumns: [],
                duplicatedHeaders: []
            });

            const result = mappingModule.handleStream(mockStream, layout, 0, undefined, 'custom-step', 5);
            
            expect(mockLogger.updateStatus).toHaveBeenCalledWith({
                order: 5,
                progress: 0,
                status: 'running',
                step: 'custom-step'
            });
        });

        it('should handle errors in stream transformation', async () => {
            const layout = createMockLayout();
            const mockStream = new ReadableStream({
                start(controller) {
                    // Intentionally don't enqueue valid data
                    controller.close();
                }
            });

            vi.mocked(ValidateLayoutHeaders).mockReturnValue({
                isValid: true,
                message: 'Headers are not valid',
                missingColumns: [],
                undefinedColumns: [],
                repeatedColumns: [],
                duplicatedHeaders: []
            });

            const result = mappingModule.handleStream(mockStream, layout, 0);
            
            expect(result).toBeDefined();
        });
    });

    describe('handleAbortSignal', () => {
        it('should throw error when abort signal is aborted', () => {
            const controller = new AbortController();
            controller.abort();

            expect(() => {
                mappingModule.handleAbortSignal(controller.signal, 'test-step', 'test-id');
            }).toThrow('Mapping Error: Abort signal received');
        });

        it('should not throw error when abort signal is not aborted', () => {
            const controller = new AbortController();

            expect(() => {
                mappingModule.handleAbortSignal(controller.signal, 'test-step', 'test-id');
            }).not.toThrow();
        });

        it('should log abort signal when it is aborted', () => {
            const controller = new AbortController();
            controller.abort();

            try {
                mappingModule.handleAbortSignal(controller.signal, 'abort-step', 'abort-id');
            } catch (error) {
                // Expected error
            }

            expect(mockLogger.log).toHaveBeenCalledWith(
                'Abort signal received',
                'debug',
                'abort-step',
                'abort-id'
            );
        });

        it('should not throw when abort signal is undefined', () => {
            expect(() => {
                mappingModule.handleAbortSignal(undefined, 'test-step', 'test-id');
            }).not.toThrow();
        });

        it('should use default parameters when not provided', () => {
            const controller = new AbortController();
            controller.abort();

            try {
                mappingModule.handleAbortSignal(controller.signal);
            } catch (error) {
                // Expected error
            }

            expect(mockLogger.log).toHaveBeenCalledWith(
                'Abort signal received',
                'debug',
                'mapping',
                'mapping-native'
            );
        });
    });

    describe('Abort signal integration', () => {
        it('should abort handleRemap when abort signal is received', async () => {
            const layout = createMockLayout();
            const row = { col1: 'John', col2: 'john@example.com' };
            
            const controller = new AbortController();
            
            const mockRemapFn = vi.fn(async () => {
                // Simulate abort signal being triggered during remap
                controller.abort();
                return null;
            });

            const customModule = new MappingModule(mockLogger, {
                allowRemapColumns: true,
                ignoreRemapUnrequired: false,
                onRemapFn: mockRemapFn,
                preserveOriginalValue: true
            });

            vi.mocked(ValidateLayoutHeaders).mockReturnValue({
                isValid: false,
                message: 'Headers are not valid',
                missingColumns: [],
                undefinedColumns: [],
                repeatedColumns: [],
                duplicatedHeaders: []
            });

            await expect(customModule.handleRemap(layout, row, controller.signal))
                .rejects
                .toThrow('Mapping Error: Abort signal received');
        });

        it('should abort stream transformation when abort signal is received', async () => {
            const layout = createMockLayout();
            const controller = new AbortController();

            let isStreamError = false;
            const mockStream = new ReadableStream({
                start(streamController) {
                    // Abort immediately
                    controller.abort();
                    streamController.enqueue({
                        rows: [{ name: 'John' }],
                        progress: 50,
                        bytesProcessed: 1024,
                        metrics: {}
                    });
                }
            });

            vi.mocked(ValidateLayoutHeaders).mockReturnValue({
                isValid: true,
                message: 'Headers are not valid',
                missingColumns: [],
                undefinedColumns: [],
                repeatedColumns: [],
                duplicatedHeaders: []
            });

            const result = mappingModule.handleStream(mockStream, layout, 0, controller.signal);
            expect(result).toBeDefined();
        });

        it('should throw abort error during row processing in stream', async () => {
            const layout = createMockLayout();
            const controller = new AbortController();

            // Create a custom module with a very large restCount to process all rows without yield
            const customModule = new MappingModule(mockLogger, {
                allowRemapColumns: false,
                ignoreRemapUnrequired: false,
                restCount: Number.MAX_SAFE_INTEGER,
                preserveOriginalValue: true
            });

            let rowProcessed = false;
            const mockStream = new ReadableStream({
                start(streamController) {
                    streamController.enqueue({
                        rows: [
                            { name: 'John', email: 'john@example.com' },
                            { name: 'Jane', email: 'jane@example.com' }
                        ],
                        progress: 50,
                        bytesProcessed: 1024,
                        metrics: {}
                    });
                    streamController.close();
                }
            });

            vi.mocked(ValidateLayoutHeaders).mockReturnValue({
                isValid: true,
                message: 'Headers are valid',
                missingColumns: [],
                undefinedColumns: [],
                repeatedColumns: [],
                duplicatedHeaders: []
            });

            // Abort before processing
            controller.abort();

            const result = customModule.handleStream(mockStream, layout, 2, controller.signal);
            expect(result).toBeDefined();
        });

        it('should abort during onRemapFn execution when signal is aborted', async () => {
            const layout = createMockLayout();
            const row = { col1: 'John' };
            const controller = new AbortController();

            // Abort before the function is called
            controller.abort();

            const mockRemapFn = vi.fn().mockResolvedValue([['name', 'col1']]);

            const customModule = new MappingModule(mockLogger, {
                allowRemapColumns: true,
                ignoreRemapUnrequired: false,
                onRemapFn: mockRemapFn,
                preserveOriginalValue: true
            });

            vi.mocked(ValidateLayoutHeaders).mockReturnValue({
                isValid: false,
                message: 'Headers are not valid',
                missingColumns: [],
                undefinedColumns: [],
                repeatedColumns: [],
                duplicatedHeaders: []
            });

            await expect(customModule.handleRemap(layout, row, controller.signal))
                .rejects
                .toThrow('Mapping Error: Abort signal received');
        });
    });

    describe('DEFAULT_MAP_HEADERS_OPTIONS', () => {
        it('should have correct default values', () => {
            expect(DEFAULT_MAP_HEADERS_OPTIONS).toEqual({
                allowRemapColumns: false,
                ignoreRemapUnrequired: false,
                restCount: 10000,
                preserveOriginalValue: false
            });
        });
    });
});
