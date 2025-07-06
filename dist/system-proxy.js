"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemProxyManager = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class SystemProxyManager {
    constructor(logger) {
        this.logger = logger;
    }
    async getNetworkServices() {
        try {
            const { stdout } = await execAsync('networksetup -listallnetworkservices');
            return stdout
                .split('\n')
                .filter(line => line.trim() && !line.includes('asterisk') && !line.startsWith('*'))
                .map(line => line.trim());
        }
        catch (error) {
            this.logger.error('Failed to get network services', error);
            return [];
        }
    }
    async getCurrentProxySettings() {
        const services = await this.getNetworkServices();
        const settings = [];
        for (const service of services) {
            try {
                const [httpProxy, httpsProxy, ftpProxy, socksProxy] = await Promise.all([
                    this.getProxySettings(service, 'webproxy'),
                    this.getProxySettings(service, 'securewebproxy'),
                    this.getProxySettings(service, 'ftpproxy'),
                    this.getProxySettings(service, 'socksfirewallproxy')
                ]);
                settings.push({
                    name: service,
                    httpProxy,
                    httpsProxy,
                    ftpProxy,
                    socksProxy
                });
            }
            catch (error) {
                this.logger.warn(`Failed to get proxy settings for ${service}`, error);
            }
        }
        return settings;
    }
    async getProxySettings(service, proxyType) {
        try {
            const { stdout } = await execAsync(`networksetup -get${proxyType} "${service}"`);
            const lines = stdout.split('\n');
            const enabled = lines.some(line => line.includes('Enabled: Yes'));
            const serverLine = lines.find(line => line.includes('Server:'));
            const portLine = lines.find(line => line.includes('Port:'));
            const authLine = lines.find(line => line.includes('Authenticated Proxy Enabled:'));
            return {
                enabled,
                server: serverLine ? serverLine.split(':')[1]?.trim() : undefined,
                port: portLine ? parseInt(portLine.split(':')[1]?.trim() || '0', 10) : undefined,
                authenticated: authLine ? authLine.includes('Yes') : false
            };
        }
        catch (error) {
            return { enabled: false };
        }
    }
    async backupCurrentSettings() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = `proxy-backup-${timestamp}.json`;
        try {
            const settings = await this.getCurrentProxySettings();
            const fs = require('fs');
            const path = require('path');
            const backupPath = path.join(process.cwd(), 'scripts', backupFile);
            fs.writeFileSync(backupPath, JSON.stringify(settings, null, 2));
            this.backupFile = backupPath;
            this.logger.info(`Proxy settings backed up to: ${backupPath}`);
            return backupPath;
        }
        catch (error) {
            this.logger.error('Failed to backup proxy settings', error);
            throw error;
        }
    }
    async enableSystemProxy(proxyHost, proxyPort) {
        this.logger.info(`Enabling system proxy: ${proxyHost}:${proxyPort}`);
        await this.backupCurrentSettings();
        const services = await this.getNetworkServices();
        for (const service of services) {
            try {
                // Set HTTP proxy
                await execAsync(`networksetup -setwebproxy "${service}" ${proxyHost} ${proxyPort}`);
                await execAsync(`networksetup -setwebproxystate "${service}" on`);
                // Set HTTPS proxy
                await execAsync(`networksetup -setsecurewebproxy "${service}" ${proxyHost} ${proxyPort}`);
                await execAsync(`networksetup -setsecurewebproxystate "${service}" on`);
                // Set FTP proxy
                await execAsync(`networksetup -setftpproxy "${service}" ${proxyHost} ${proxyPort}`);
                await execAsync(`networksetup -setftpproxystate "${service}" on`);
                this.logger.debug(`Proxy enabled for service: ${service}`);
            }
            catch (error) {
                this.logger.warn(`Failed to enable proxy for ${service}`, error);
            }
        }
        this.logger.info('System proxy configuration completed');
    }
    async disableSystemProxy() {
        this.logger.info('Disabling system proxy');
        const services = await this.getNetworkServices();
        for (const service of services) {
            try {
                // Disable HTTP proxy
                await execAsync(`networksetup -setwebproxystate "${service}" off`);
                // Disable HTTPS proxy
                await execAsync(`networksetup -setsecurewebproxystate "${service}" off`);
                // Disable FTP proxy
                await execAsync(`networksetup -setftpproxystate "${service}" off`);
                // Disable SOCKS proxy
                await execAsync(`networksetup -setsocksfirewallproxystate "${service}" off`);
                this.logger.debug(`Proxy disabled for service: ${service}`);
            }
            catch (error) {
                this.logger.warn(`Failed to disable proxy for ${service}`, error);
            }
        }
        this.logger.info('System proxy disabled');
    }
    async restoreFromBackup(backupPath) {
        const backupFile = backupPath || this.backupFile;
        if (!backupFile) {
            throw new Error('No backup file specified');
        }
        try {
            const fs = require('fs');
            const settings = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
            for (const service of settings) {
                // Restore HTTP proxy
                if (service.httpProxy?.enabled && service.httpProxy.server && service.httpProxy.port) {
                    await execAsync(`networksetup -setwebproxy "${service.name}" ${service.httpProxy.server} ${service.httpProxy.port}`);
                    await execAsync(`networksetup -setwebproxystate "${service.name}" on`);
                }
                else {
                    await execAsync(`networksetup -setwebproxystate "${service.name}" off`);
                }
                // Restore HTTPS proxy
                if (service.httpsProxy?.enabled && service.httpsProxy.server && service.httpsProxy.port) {
                    await execAsync(`networksetup -setsecurewebproxy "${service.name}" ${service.httpsProxy.server} ${service.httpsProxy.port}`);
                    await execAsync(`networksetup -setsecurewebproxystate "${service.name}" on`);
                }
                else {
                    await execAsync(`networksetup -setsecurewebproxystate "${service.name}" off`);
                }
                // Restore FTP proxy
                if (service.ftpProxy?.enabled && service.ftpProxy.server && service.ftpProxy.port) {
                    await execAsync(`networksetup -setftpproxy "${service.name}" ${service.ftpProxy.server} ${service.ftpProxy.port}`);
                    await execAsync(`networksetup -setftpproxystate "${service.name}" on`);
                }
                else {
                    await execAsync(`networksetup -setftpproxystate "${service.name}" off`);
                }
            }
            this.logger.info(`Proxy settings restored from: ${backupFile}`);
        }
        catch (error) {
            this.logger.error('Failed to restore proxy settings', error);
            throw error;
        }
    }
    async checkPermissions() {
        try {
            await execAsync('networksetup -listallnetworkservices');
            return true;
        }
        catch (error) {
            this.logger.error('Insufficient permissions to modify network settings', error);
            return false;
        }
    }
}
exports.SystemProxyManager = SystemProxyManager;
//# sourceMappingURL=system-proxy.js.map