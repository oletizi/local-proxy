export interface ProxyConfig {
    port: number;
    host: string;
    logLevel: 'silent' | 'error' | 'warn' | 'info' | 'debug';
    logFile?: string;
    enableHttps: boolean;
    httpsPort?: number;
}
export interface RequestLog {
    timestamp: string;
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
    sourceIp: string;
    userAgent?: string;
}
export interface ResponseLog {
    timestamp: string;
    statusCode: number;
    headers: Record<string, string>;
    body?: string;
    responseTime: number;
}
export interface TransactionLog {
    id: string;
    request: RequestLog;
    response?: ResponseLog;
    error?: string;
}
//# sourceMappingURL=types.d.ts.map