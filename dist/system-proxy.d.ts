import { ProxyLogger } from './logger';
export interface NetworkService {
    name: string;
    httpProxy?: ProxySettings;
    httpsProxy?: ProxySettings;
    ftpProxy?: ProxySettings;
    socksProxy?: ProxySettings;
}
export interface ProxySettings {
    enabled: boolean;
    server?: string;
    port?: number;
    authenticated?: boolean;
}
export declare class SystemProxyManager {
    private logger;
    private backupFile?;
    constructor(logger: ProxyLogger);
    getNetworkServices(): Promise<string[]>;
    getCurrentProxySettings(): Promise<NetworkService[]>;
    private getProxySettings;
    backupCurrentSettings(): Promise<string>;
    enableSystemProxy(proxyHost: string, proxyPort: number): Promise<void>;
    disableSystemProxy(): Promise<void>;
    restoreFromBackup(backupPath?: string): Promise<void>;
    checkPermissions(): Promise<boolean>;
}
//# sourceMappingURL=system-proxy.d.ts.map