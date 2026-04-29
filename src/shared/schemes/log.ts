export type Log = {
    timestamp: Date;
    id: string;
    message: string;
    level: 'info' | 'warn' | 'error' | 'debug' | 'success';
    step: string;
}