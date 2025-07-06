import { ProxyConfig } from './types';
export declare class LocalProxy {
    private app;
    private logger;
    private config;
    private transactions;
    private systemProxyManager;
    constructor(config: ProxyConfig);
    private setupMiddleware;
    private setupRoutes;
    start(): Promise<void>;
    stop(): void;
}
//# sourceMappingURL=proxy.d.ts.map