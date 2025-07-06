import { TransactionLog, ProxyConfig } from './types';
export declare class ProxyLogger {
    private logStream?;
    private config;
    constructor(config: ProxyConfig);
    log(level: string, message: string, data?: any): void;
    logTransaction(transaction: TransactionLog): void;
    error(message: string, error?: any): void;
    warn(message: string, data?: any): void;
    info(message: string, data?: any): void;
    debug(message: string, data?: any): void;
    private shouldLog;
    close(): void;
}
//# sourceMappingURL=logger.d.ts.map