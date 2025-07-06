import { ProxyConfig } from './types';
export declare class LocalProxy {
    private app;
    private server;
    private logger;
    private config;
    private transactions;
    private systemProxyManager;
    constructor(config: ProxyConfig);
    private setupMiddleware;
    private setupRoutes;
    private setupHttpsProxy;
    start(): Promise<void>;
    stop(): void;
}
//# sourceMappingURL=proxy.d.ts.map