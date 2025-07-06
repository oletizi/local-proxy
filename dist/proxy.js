"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalProxy = void 0;
const express_1 = __importDefault(require("express"));
const http_proxy_middleware_1 = require("http-proxy-middleware");
const cors_1 = __importDefault(require("cors"));
const uuid_1 = require("uuid");
const logger_1 = require("./logger");
const system_proxy_1 = require("./system-proxy");
class LocalProxy {
    constructor(config) {
        this.transactions = new Map();
        this.config = config;
        this.logger = new logger_1.ProxyLogger(config);
        this.systemProxyManager = new system_proxy_1.SystemProxyManager(this.logger);
        this.app = (0, express_1.default)();
        this.setupMiddleware();
        this.setupRoutes();
    }
    setupMiddleware() {
        this.app.use((0, cors_1.default)());
        this.app.use(express_1.default.json({ limit: '10mb' }));
        this.app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
        this.app.use((req, res, next) => {
            const transactionId = (0, uuid_1.v4)();
            const startTime = Date.now();
            const requestLog = {
                timestamp: new Date().toISOString(),
                method: req.method,
                url: req.url,
                headers: req.headers,
                body: req.body ? JSON.stringify(req.body) : undefined,
                sourceIp: req.ip || req.connection.remoteAddress || 'unknown',
                userAgent: req.get('User-Agent')
            };
            const transaction = {
                id: transactionId,
                request: requestLog
            };
            this.transactions.set(transactionId, transaction);
            const originalSend = res.send;
            res.send = function (data) {
                const responseTime = Date.now() - startTime;
                const responseLog = {
                    timestamp: new Date().toISOString(),
                    statusCode: res.statusCode,
                    headers: res.getHeaders(),
                    body: typeof data === 'string' ? data : JSON.stringify(data),
                    responseTime
                };
                transaction.response = responseLog;
                return originalSend.call(this, data);
            };
            res.on('finish', () => {
                this.logger.logTransaction(transaction);
                this.transactions.delete(transactionId);
            });
            next();
        });
    }
    setupRoutes() {
        this.app.get('/proxy/status', (req, res) => {
            res.json({
                status: 'running',
                config: {
                    port: this.config.port,
                    host: this.config.host,
                    logLevel: this.config.logLevel,
                    enableHttps: this.config.enableHttps
                },
                activeTransactions: this.transactions.size
            });
        });
        this.app.get('/proxy/logs', (req, res) => {
            const logs = Array.from(this.transactions.values());
            res.json(logs);
        });
        this.app.get('/proxy/system-settings', async (req, res) => {
            try {
                const settings = await this.systemProxyManager.getCurrentProxySettings();
                res.json(settings);
            }
            catch (error) {
                res.status(500).json({ error: 'Failed to get system proxy settings' });
            }
        });
        this.app.post('/proxy/system-enable', async (req, res) => {
            try {
                await this.systemProxyManager.enableSystemProxy(this.config.host, this.config.port);
                res.json({ success: true, message: 'System proxy enabled' });
            }
            catch (error) {
                res.status(500).json({ error: 'Failed to enable system proxy' });
            }
        });
        this.app.post('/proxy/system-disable', async (req, res) => {
            try {
                await this.systemProxyManager.disableSystemProxy();
                res.json({ success: true, message: 'System proxy disabled' });
            }
            catch (error) {
                res.status(500).json({ error: 'Failed to disable system proxy' });
            }
        });
        const proxyOptions = {
            target: undefined,
            changeOrigin: true,
            router: (req) => {
                const targetUrl = req.headers['x-target-url'] || req.url;
                if (targetUrl.startsWith('/proxy/')) {
                    throw new Error('Cannot proxy to proxy endpoints');
                }
                if (!targetUrl.startsWith('http')) {
                    return `http://${targetUrl}`;
                }
                return targetUrl;
            },
            onError: (err, req, res) => {
                this.logger.error('Proxy error', { error: err.message, url: req.url });
                if (res && !res.headersSent) {
                    res.status(500).json({ error: 'Proxy error', message: err.message });
                }
            },
            onProxyReq: (proxyReq, req, res) => {
                this.logger.debug('Proxying request', {
                    method: req.method,
                    url: req.url,
                    target: req.headers['x-target-url']
                });
            },
            onProxyRes: (proxyRes, req, res) => {
                this.logger.debug('Received response', {
                    statusCode: proxyRes.statusCode,
                    url: req.url
                });
            }
        };
        this.app.use('/proxy/forward', (0, http_proxy_middleware_1.createProxyMiddleware)(proxyOptions));
    }
    start() {
        return new Promise((resolve, reject) => {
            try {
                this.app.listen(this.config.port, this.config.host, () => {
                    this.logger.info(`Local proxy started`, {
                        host: this.config.host,
                        port: this.config.port,
                        logLevel: this.config.logLevel
                    });
                    resolve();
                });
            }
            catch (error) {
                this.logger.error('Failed to start proxy', error);
                reject(error);
            }
        });
    }
    stop() {
        this.logger.info('Stopping proxy server');
        this.logger.close();
    }
}
exports.LocalProxy = LocalProxy;
//# sourceMappingURL=proxy.js.map