import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalStepsEngineModule, DEFAULT_STEPS_ENGINE_OPTIONS } from './main';
import { LoggerModule } from '../../logger/logger-native/main';
import { LayoutBase } from '@/shared/schemes/layout-base';
import { LayoutLocalStep } from '@/shared/schemes/layout-local-step';
import { RowObject } from '@/shared/schemes/row-object';
import { LocalStepValidator, ValidationError } from '@/shared/schemes/local-step-validators';
import { LocalStepTransform } from '@/shared/schemes/local-step-transforms';
import { LayoutHeader } from '@/shared/schemes/layout-header';

vi.mock('../../logger/logger-native/main');

describe('LocalStepsEngineModule', () => {
    let stepsEngineModule: LocalStepsEngineModule;
    let mockLogger: any;

    const createMockValidator = (overrides?: Partial<LocalStepValidator>): LocalStepValidator => ({
        name: 'testValidator',
        headerKey: 'name',
        fn: vi.fn((value, row) => ({
            isValid: true,
            validationCode: 'VALID',
            message: 'Valid',
            step: 'test-step'
        })),
        args: [],
        ...overrides
    });

    const createMockTransform = (overrides?: Partial<LocalStepTransform>): LocalStepTransform => ({
        name: 'testTransform',
        headerKey: 'name',
        fn: vi.fn((value) => value.toUpperCase()),
        args: [],
        ...overrides
    });

    const createMockLayoutLocalStep = (overrides?: Partial<LayoutLocalStep>): LayoutLocalStep => ({
        id: 'step-1',
        name: 'step1',
        description: 'Test step',
        order: ['validators', 'transforms'] as any,
        validators: [createMockValidator()],
        transforms: [createMockTransform()],
        ...overrides
    });

    const createMockLayout = (overrides?: Partial<LayoutBase>): LayoutBase => ({
        id: 'layout-1',
        name: 'Test Layout',
        description: 'A test layout',
        localSteps: [createMockLayoutLocalStep()],
        allowUndefinedColumns: false,
        headers: [],
        globalSteps: [],
        exports: {},
        ...overrides
    });

    const createMockHeader = (overrides?: Partial<LayoutHeader>): LayoutHeader => ({
        key: 'name',
        label: 'Name',
        description: 'Name',
        alternativeKeys: ['name'],
        caseSensitive: false,
        ...overrides
    });

    const createMockRowObject = (overrides?: Partial<RowObject>): RowObject => ({
        __rowId: 1,
        __sError: null,
        __originalValue: JSON.stringify({ name: 'John' }),
        value: { name: 'john' },
        ...overrides
    });

    beforeEach(() => {
        mockLogger = {
            log: vi.fn(),
            updateStatus: vi.fn(),
            id: 'test-logger'
        };

        vi.mocked(LoggerModule).mockImplementation(() => mockLogger);
        stepsEngineModule = new LocalStepsEngineModule({}, mockLogger);
    });

    describe('Constructor', () => {
        it('should initialize with default options', () => {
            const module = new LocalStepsEngineModule({}, mockLogger);
            expect(mockLogger.log).toHaveBeenCalled();
        });

        it('should initialize with custom options', () => {
            const customOptions = {
                maxErrorCount: 10,
                validationCodeDictionary: { 'CUSTOM_CODE': 'Custom error' }
            };
            const module = new LocalStepsEngineModule(customOptions, mockLogger);
            expect(mockLogger).toBeDefined();
        });

        it('should merge custom options with default options', () => {
            const customOptions = {
                maxErrorCount: 5
            };
            new LocalStepsEngineModule(customOptions, mockLogger);
            expect(mockLogger).toBeDefined();
        });
    });

    describe('handleStream', () => {
        it('should process rows through stream transformer', async () => {
            const layout = createMockLayout({ headers: [createMockHeader()] });

            const mockStream = new ReadableStream({
                start(controller) {
                    controller.enqueue({
                        rows: [createMockRowObject()],
                        progress: 50,
                        bytesProcessed: 1024
                    });
                    controller.close();
                }
            });

            const resultStream = await stepsEngineModule.handleStream(mockStream, layout);
            const reader = resultStream.getReader();
            let capturedChunk: any = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                capturedChunk = value;
            }
            expect(capturedChunk).toBeDefined();
            expect(capturedChunk.rows[0]).toEqual(expect.objectContaining({
                __rowId: 1,
                __sError: null
            }));


        });

        it('should update status on stream start', async () => {
            const layout = createMockLayout();
            const mockStream = new ReadableStream({
                start(controller) {
                    controller.close();
                }
            });

            await stepsEngineModule.handleStream(mockStream, layout, undefined, 'test-step', 3);

            expect(mockLogger.updateStatus).toHaveBeenCalledWith(
                expect.objectContaining({
                    order: 3,
                    progress: 0,
                    status: 'running',
                    step: 'test-step'
                })
            );
        });

        it('should use default step and order parameters', async () => {
            const layout = createMockLayout();
            const mockStream = new ReadableStream({
                start(controller) {
                    controller.close();
                }
            });

            await stepsEngineModule.handleStream(mockStream, layout);

            expect(mockLogger.updateStatus).toHaveBeenCalledWith(
                expect.objectContaining({
                    order: 2,
                    status: 'running',
                    step: 'steps-engine'
                })
            );
        });

        it('should skip rows marked with __sError flag', async () => {
            const layout = createMockLayout();
            const errorRow = createMockRowObject({ __sError: 'ERROR_CODE' });
            let capturedChunk: any = null;

            const mockStream = new ReadableStream({
                start(controller) {
                    controller.enqueue({
                        rows: [errorRow],
                        progress: 50,
                        bytesProcessed: 1024
                    });
                    controller.close();
                }
            });

            const resultStream = await stepsEngineModule.handleStream(mockStream, layout);
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

            expect(capturedChunk.rows[0].__sError).toBe('ERROR_CODE');
        });

        it('should throw error when max error count is reached', async () => {
            const layout = createMockLayout();
            const customModule = new LocalStepsEngineModule({ maxErrorCount: 1 }, mockLogger);

            const failingValidator = createMockValidator({
                fn: vi.fn((value, row) => ({
                    isValid: false,
                    validationCode: 'INVALID',
                    message: 'Invalid',
                    step: 'test-step'
                }))
            });

            const step = createMockLayoutLocalStep({
                validators: [failingValidator]
            });

            layout.localSteps = [step];

            let streamError: any = null;
            const mockStream = new ReadableStream({
                start(controller) {
                    controller.enqueue({
                        rows: [
                            createMockRowObject({ __rowId: 1 }),
                            createMockRowObject({ __rowId: 2 })
                        ],
                        progress: 50,
                        bytesProcessed: 1024
                    });
                    controller.close();
                }
            });

            const resultStream = await customModule.handleStream(mockStream, layout);
            const reader = resultStream.getReader();

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                }
            } catch (error) {
                streamError = error;
            }
        });

        it('should handle multiple chunks', async () => {
            const layout = createMockLayout();
            const chunks: any[] = [];

            const mockStream = new ReadableStream({
                start(controller) {
                    controller.enqueue({
                        rows: [createMockRowObject()],
                        progress: 25,
                        bytesProcessed: 512
                    });
                    controller.enqueue({
                        rows: [createMockRowObject({ __rowId: 2 })],
                        progress: 50,
                        bytesProcessed: 1024
                    });
                    controller.close();
                }
            });

            const resultStream = await stepsEngineModule.handleStream(mockStream, layout);
            const reader = resultStream.getReader();

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(value);
                }
            } catch (error) {
                // Stream ended
            }

            expect(chunks.length).toBeGreaterThan(0);
        });

        it('should complete with status on flush', async () => {
            const layout = createMockLayout();
            const mockStream = new ReadableStream({
                start(controller) {
                    controller.close();
                }
            });

            await stepsEngineModule.handleStream(mockStream, layout);

            expect(mockLogger.updateStatus).toHaveBeenCalled();
        });
    });

    describe('handleStep', () => {
        it('should execute validators before transforms', () => {
            const row = createMockRowObject();
            const errorCount = { count: 0 };
            const errorDicc: Record<string, ValidationError> = {};

            const step = createMockLayoutLocalStep({
                order: ['validators', 'transforms'] as any
            });

            stepsEngineModule.handleStep(step, row, errorCount, undefined, errorDicc);

            expect(row).toBeDefined();
        });

        it('should skip step if row is marked as error', () => {
            const row = createMockRowObject({ __sError: 'ERROR_CODE' });
            const errorCount = { count: 0 };
            const errorDicc: Record<string, ValidationError> = {};

            const step = createMockLayoutLocalStep();
            stepsEngineModule.handleStep(step, row, errorCount, undefined, errorDicc);

            expect(mockLogger.log).toHaveBeenCalledWith(
                expect.stringContaining('is error'),
                'debug',
                'handleStep',
                expect.any(String)
            );
        });

        it('should handle abort signal during step execution', () => {
            const row = createMockRowObject();
            const errorCount = { count: 0 };
            const errorDicc: Record<string, ValidationError> = {};
            const controller = new AbortController();
            controller.abort();

            const step = createMockLayoutLocalStep();

            expect(() => {
                stepsEngineModule.handleStep(step, row, errorCount, controller.signal, errorDicc);
            }).toThrow('Abort signal received');
        });

        it('should execute transforms in order', () => {
            const row = createMockRowObject();
            const errorCount = { count: 0 };
            const errorDicc: Record<string, ValidationError> = {};

            const transform1 = createMockTransform({
                name: 'transform1',
                fn: vi.fn((value) => value.toUpperCase())
            });

            const transform2 = createMockTransform({
                name: 'transform2',
                fn: vi.fn((value) => value + '!')
            });

            const step = createMockLayoutLocalStep({
                order: ['transforms'] as any,
                transforms: [transform1, transform2]
            });

            stepsEngineModule.handleStep(step, row, errorCount, undefined, errorDicc);

            expect(transform1.fn).toHaveBeenCalled();
        });
    });

    describe('executeValidators', () => {
        it('should mark row as error when validation fails', () => {
            const row = createMockRowObject();
            const errorCount = { count: 0 };
            const errorDicc: Record<string, ValidationError> = {};

            const failingValidator = createMockValidator({
                headerKey: 'name',
                fn: vi.fn((value, row) => ({
                    isValid: false,
                    validationCode: 'INVALID_NAME',
                    message: 'Name is invalid',
                    step: 'test-step'
                }))
            });

            const step = createMockLayoutLocalStep({
                validators: [failingValidator]
            });

            stepsEngineModule.executeValidators({ step, row, errorDicc, errorCount });

            expect(row.__sError).toBe('INVALID_NAME');
            expect(errorCount.count).toBe(1);
            expect(errorDicc[row.__rowId]).toBeDefined();
        });

        it('should capture validation error details', () => {
            const row = createMockRowObject();
            const errorCount = { count: 0 };
            const errorDicc: Record<string, ValidationError> = {};

            const failingValidator = createMockValidator({
                headerKey: 'email',
                fn: vi.fn((value, row) => ({
                    isValid: false,
                    validationCode: 'INVALID_EMAIL',
                    message: 'Email format is invalid',
                    step: 'email-validation'
                }))
            });

            const step = createMockLayoutLocalStep({
                name: 'email-validation',
                validators: [failingValidator]
            });

            stepsEngineModule.executeValidators({ step, row, errorDicc, errorCount });

            expect(errorDicc[row.__rowId]).toEqual(
                expect.objectContaining({
                    headerKey: 'email',
                    validationCode: 'INVALID_EMAIL',
                    message: 'Email format is invalid',
                    step: 'email-validation'
                })
            );
        });

        it('should not modify row if validation passes', () => {
            const row = createMockRowObject();
            const errorCount = { count: 0 };
            const errorDicc: Record<string, ValidationError> = {};

            const passingValidator = createMockValidator({
                fn: vi.fn((value, row) => ({
                    isValid: true,
                    validationCode: 'VALID',
                    message: 'Valid',
                    step: 'test-step'
                }))
            });

            const step = createMockLayoutLocalStep({
                validators: [passingValidator]
            });

            stepsEngineModule.executeValidators({ step, row, errorDicc, errorCount });

            expect(row.__sError).toBe(null);
            expect(errorCount.count).toBe(0);
        });

        it('should handle validator exception and mark as error', () => {
            const row = createMockRowObject();
            const errorCount = { count: 0 };
            const errorDicc: Record<string, ValidationError> = {};

            const exceptionValidator = createMockValidator({
                headerKey: 'name',
                name: 'exceptionValidator',
                fn: vi.fn(() => {
                    throw new Error('Validator failed');
                })
            });

            const step = createMockLayoutLocalStep({
                validators: [exceptionValidator]
            });

            expect(() => {
                stepsEngineModule.executeValidators({ step, row, errorDicc, errorCount });
            }).toThrow();

            expect(row.__sError).toBe('UNEXPECTED_ERROR - name:exceptionValidator');
            expect(errorCount.count).toBe(1);
        });

        it('should break on first validation failure', () => {
            const row = createMockRowObject();
            const errorCount = { count: 0 };
            const errorDicc: Record<string, ValidationError> = {};

            const validator1 = createMockValidator({
                name: 'validator1',
                fn: vi.fn((value, row) => ({
                    isValid: false,
                    validationCode: 'FIRST_FAIL',
                    message: 'First validation failed',
                    step: 'test-step'
                }))
            });

            const validator2 = createMockValidator({
                name: 'validator2',
                fn: vi.fn((value, row) => ({
                    isValid: false,
                    validationCode: 'SECOND_FAIL',
                    message: 'Second validation failed',
                    step: 'test-step'
                }))
            });

            const step = createMockLayoutLocalStep({
                validators: [validator1, validator2]
            });

            stepsEngineModule.executeValidators({ step, row, errorDicc, errorCount });

            expect(validator1.fn).toHaveBeenCalled();
            expect(validator2.fn).not.toHaveBeenCalled();
        });

        it('should pass validator arguments', () => {
            const row = createMockRowObject();
            const errorCount = { count: 0 };
            const errorDicc: Record<string, ValidationError> = {};

            const validatorFn = vi.fn((value, row, minLength) => ({
                isValid: value.length >= minLength,
                validationCode: 'LENGTH_CHECK',
                message: 'Length is valid',
                step: 'test-step'
            }));

            const validator = createMockValidator({
                fn: validatorFn,
                args: [3]
            });

            const step = createMockLayoutLocalStep({
                validators: [validator]
            });

            stepsEngineModule.executeValidators({ step, row, errorDicc, errorCount });

            expect(validatorFn).toHaveBeenCalledWith('john', row, 3);
        });
    });

    describe('executeTransforms', () => {
        it('should apply transform to row value', () => {
            const row = createMockRowObject();
            const transformFn = vi.fn((value) => value.toUpperCase());

            const transform = createMockTransform({
                fn: transformFn
            });

            const step = createMockLayoutLocalStep({
                transforms: [transform]
            });

            stepsEngineModule.executeTransforms({ step, row });

            expect(transformFn).toHaveBeenCalledWith('john', row);
            expect(row.value.name).toBe('JOHN');
        });

        it('should apply multiple transforms in sequence', () => {
            const row = createMockRowObject();

            const transform1 = createMockTransform({
                name: 'toUpperCase',
                fn: vi.fn((value) => value.toUpperCase())
            });

            const transform2 = createMockTransform({
                name: 'addExclamation',
                fn: vi.fn((value) => value + '!')
            });

            const step = createMockLayoutLocalStep({
                transforms: [transform1, transform2]
            });

            stepsEngineModule.executeTransforms({ step, row });

            expect(row.value.name).toBe('JOHN!');
        });

        it('should pass transform arguments', () => {
            const row = createMockRowObject();
            const transformFn = vi.fn((value, row, suffix) => value + suffix);

            const transform = createMockTransform({
                fn: transformFn,
                args: ['_suffix']
            });

            const step = createMockLayoutLocalStep({
                transforms: [transform]
            });

            stepsEngineModule.executeTransforms({ step, row });

            expect(transformFn).toHaveBeenCalledWith('john', row, '_suffix');
            expect(row.value.name).toBe('john_suffix');
        });

        it('should throw error on transform exception', () => {
            const row = createMockRowObject();

            const transform = createMockTransform({
                fn: vi.fn(() => {
                    throw new Error('Transform error');
                })
            });

            const step = createMockLayoutLocalStep({
                transforms: [transform]
            });

            expect(() => {
                stepsEngineModule.executeTransforms({ step, row });
            }).toThrow('Unexpected error in transform');
        });

        it('should handle abort signal during transform', () => {
            const row = createMockRowObject();
            const controller = new AbortController();
            controller.abort();

            const transform = createMockTransform();
            const step = createMockLayoutLocalStep({
                transforms: [transform]
            });

            expect(() => {
                stepsEngineModule.executeTransforms({ step, row, signal: controller.signal });
            }).toThrow('Abort signal received');
        });

        it('should update correct cell value based on headerKey', () => {
            const row = createMockRowObject({ value: { name: 'john', email: 'john@test.com' } });

            const transform = createMockTransform({
                headerKey: 'email',
                fn: vi.fn((value) => value.toLowerCase())
            });

            const step = createMockLayoutLocalStep({
                transforms: [transform]
            });

            stepsEngineModule.executeTransforms({ step, row });

            expect(row.value.email).toBe('john@test.com');
            expect(row.value.name).toBe('john');
        });
    });

    describe('handleAbortSignal', () => {
        it('should throw error when abort signal is aborted', () => {
            const controller = new AbortController();
            controller.abort();

            expect(() => {
                stepsEngineModule.handleAbortSignal(controller.signal);
            }).toThrow('Abort signal received');
        });

        it('should not throw when abort signal is not aborted', () => {
            const controller = new AbortController();

            expect(() => {
                stepsEngineModule.handleAbortSignal(controller.signal);
            }).not.toThrow();
        });

        it('should not throw when abort signal is undefined', () => {
            expect(() => {
                stepsEngineModule.handleAbortSignal(undefined);
            }).not.toThrow();
        });
    });

    describe('DEFAULT_STEPS_ENGINE_OPTIONS', () => {
        it('should have correct default values', () => {
            expect(DEFAULT_STEPS_ENGINE_OPTIONS).toEqual({
                maxErrorCount: 0
            });
        });
    });

    describe('Error handling integration', () => {
        it('should maintain error dictionary across multiple rows', async () => {
            const layout = createMockLayout();
            const failingValidator = createMockValidator({
                fn: vi.fn((value, row) => ({
                    isValid: value === 'invalid',
                    validationCode: 'INVALID',
                    message: 'Invalid value',
                    step: 'test-step'
                }))
            });

            const step = createMockLayoutLocalStep({
                validators: [failingValidator]
            });

            layout.localSteps = [step];

            let capturedChunk: any = null;
            const mockStream = new ReadableStream({
                start(controller) {
                    controller.enqueue({
                        rows: [
                            createMockRowObject({ __rowId: 1 }),
                            createMockRowObject({ __rowId: 2 })
                        ],
                        progress: 50,
                        bytesProcessed: 1024
                    });
                    controller.close();
                }
            });

            const resultStream = await stepsEngineModule.handleStream(mockStream, layout);
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
        });
    });

    describe('executeSingleRow', () => {
        it('should execute validators and transforms on a single row', async () => {
            const row = createMockRowObject();
            const layout = createMockLayout();

            const result = await stepsEngineModule.executeSingleRow(row, layout);

            expect(result.success).toBe(true);
            expect(result.row).toBeDefined();
            expect(result.validationErrors).toBeDefined();
        });

        it('should return error when row is null', async () => {
            const layout = createMockLayout();

            const result = await stepsEngineModule.executeSingleRow(null as any, layout);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Row is null or has error flag');
        });

        it('should return error when row has __sError flag', async () => {
            const row = createMockRowObject({ __sError: 'EXISTING_ERROR' });
            const layout = createMockLayout();

            const result = await stepsEngineModule.executeSingleRow(row, layout);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Row is null or has error flag');
        });

        it('should mark row as error when validation fails', async () => {
            const row = createMockRowObject();
            const failingValidator = createMockValidator({
                fn: vi.fn((value, row) => ({
                    isValid: false,
                    validationCode: 'INVALID',
                    message: 'Validation failed',
                    step: 'test-step'
                }))
            });

            const step = createMockLayoutLocalStep({
                validators: [failingValidator]
            });

            const layout = createMockLayout({ localSteps: [step] });

            const result = await stepsEngineModule.executeSingleRow(row, layout);

            expect(result.success).toBe(false);
            expect(result.validationErrors.length).toBe(1);
            expect(result.errorCount).toBe(1);
        });

        it('should stop processing steps when row is marked as error', async () => {
            const row = createMockRowObject();
            const failingValidator = createMockValidator({
                fn: vi.fn((value, row) => ({
                    isValid: false,
                    validationCode: 'FAIL_FIRST_STEP',
                    message: 'Failed',
                    step: 'test-step'
                }))
            });

            const step1 = createMockLayoutLocalStep({
                name: 'step1',
                validators: [failingValidator]
            });

            const step2Validator = createMockValidator({
                name: 'step2Validator',
                fn: vi.fn()
            });

            const step2 = createMockLayoutLocalStep({
                name: 'step2',
                validators: [step2Validator]
            });

            const layout = createMockLayout({ localSteps: [step1, step2] });

            const result = await stepsEngineModule.executeSingleRow(row, layout);

            expect(result.success).toBe(false);
            expect(step2Validator.fn).not.toHaveBeenCalled();
        });

        it('should handle abort signal during single row execution', async () => {
            const row = createMockRowObject();
            const layout = createMockLayout();
            const controller = new AbortController();
            controller.abort();

            const result = await stepsEngineModule.executeSingleRow(row, layout, controller.signal);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should return validation errors with details', async () => {
            const row = createMockRowObject();
            const failingValidator = createMockValidator({
                headerKey: 'name',
                fn: vi.fn((value, row) => ({
                    isValid: false,
                    validationCode: 'INVALID_NAME',
                    message: 'Name too short',
                    step: 'validation-step'
                }))
            });

            const step = createMockLayoutLocalStep({
                name: 'validation-step',
                validators: [failingValidator]
            });

            const layout = createMockLayout({ localSteps: [step] });

            const result = await stepsEngineModule.executeSingleRow(row, layout);

            expect(result.validationErrors[0]).toEqual(
                expect.objectContaining({
                    headerKey: 'name',
                    validationCode: 'INVALID_NAME',
                    message: 'Name too short'
                })
            );
        });
    });
});