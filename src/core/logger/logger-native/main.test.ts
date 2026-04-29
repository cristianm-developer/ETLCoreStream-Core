import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoggerModule } from './main';


describe("LoggerLoggerNativeModule", () => {

    let logger: LoggerModule;

    beforeEach(() => {
        logger = new LoggerModule();
    })

    describe("Logs", () => {

        it('Should log a message and emit it in the logs$ observable', (done) => {
            const testMessage = 'Test log message';
            const testLevel = 'info' as const;
            const testStep = 'test-step';

            logger.logs$.subscribe(log => {
                expect(log.message).toBe(testMessage);
                expect(log.level).toBe(testLevel);
                expect(log.step).toBe(testStep);
                expect(log.id).toBe(logger.id);
                expect(log.timestamp).toBeInstanceOf(Date);
            });

            logger.log(testMessage, testLevel, testStep, logger.id);
        })

        it('Should clean logs when restartLogs is called', () => {
            logger.log('Message 1', 'info', 'step1', logger.id);
            logger.log('Message 2', 'warn', 'step2', logger.id);

            expect(logger.getLogs(undefined, undefined, 0, 1000)).toHaveLength(2);

            logger.restartLogs();
            expect(logger.getLogs(undefined, undefined, 0, 1000)).toHaveLength(0);
        })


    })

    describe("Status", () => {

        it('Should update status and emit it in the status$ ', (done) => {
            const testStatus = {
                order: 1,
                progress: 50,
                status: 'running' as const,
                step: 'importing'
            };

            logger.status$.subscribe(status => {
                expect(status.order).toBe(testStatus.order);
                expect(status.progress).toBe(testStatus.progress);
                expect(status.status).toBe(testStatus.status);
                expect(status.step).toBe(testStatus.step);
            });

            logger.updateStatus(testStatus);
        })

        it('Should recover status in order', () => {
            const status1 = { order: 1, progress: 25, status: 'running' as const, step: 'step1' };
            const status2 = { order: 2, progress: 50, status: 'running' as const, step: 'step2' };
            const status3 = { order: 3, progress: 75, status: 'completed' as const, step: 'step3' };

            logger.updateStatus(status1);
            logger.updateStatus(status2);
            logger.updateStatus(status3);

            expect(logger.getStatusLog(1)).toEqual(status1);
            expect(logger.getStatusLog(2)).toEqual(status2);
            expect(logger.getStatusLog(3)).toEqual(status3);
        })
        
    })

    describe('GetLogs', () => {
        it('Should return logs in the correct order', () => {
            logger.log('First message', 'info', 'step1', logger.id);
            logger.log('Second message', 'warn', 'step2', logger.id);
            logger.log('Third message', 'error', 'step3', logger.id);

            const now = new Date();
            const future = new Date(now.getTime() + 10000);
            const allLogs = logger.getLogs(new Date(0), future, 0, 100);

            expect(allLogs).toHaveLength(3);
            expect(allLogs[0].message).toBe('First message');
            expect(allLogs[1].message).toBe('Second message');
            expect(allLogs[2].message).toBe('Third message');
        })

        it('Should return logs filtered in the correct range', () => {
            logger.log('Message 1', 'info', 'step1', logger.id);
            logger.log('Message 2', 'info', 'step1', logger.id);
            logger.log('Message 3', 'info', 'step1', logger.id);
            logger.log('Message 4', 'info', 'step1', logger.id);

            const logsInRange = logger.getLogs(undefined, undefined, 1, 2);

            expect(logsInRange).toHaveLength(2);
            expect(logsInRange[0].message).toBe('Message 2');
            expect(logsInRange[1].message).toBe('Message 3');
        })

        it('Should return logs filtered by level', () => {
            const now = new Date();
            const future = new Date(now.getTime() + 10000);

            logger.log('Info message', 'info', 'step1', logger.id);
            logger.log('Warning message', 'warn', 'step1', logger.id);
            logger.log('Error message', 'error', 'step1', logger.id);
            logger.log('Debug message', 'debug', 'step1', logger.id);

            const errorLogs = logger.getLogs(new Date(0), future, 0, 100, 'error', 'step1', logger.id);

            expect(errorLogs).toHaveLength(1);
            expect(errorLogs[0].level).toBe('error');
            expect(errorLogs[0].message).toBe('Error message');
        })


    })


    
})