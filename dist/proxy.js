"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalProxy = void 0;
const express_1 = __importDefault(require("express"));
const http_proxy_middleware_1 = require("http-proxy-middleware");
const cors_1 = __importDefault(require("cors"));
const uuid_1 = require("uuid");
const http = __importStar(require("http"));
const net = __importStar(require("net"));
const logger_1 = require("./logger");
const system_proxy_1 = require("./system-proxy");
class LocalProxy {
    constructor(config) {
        this.transactions = new Map();
        this.config = config;
        this.logger = new logger_1.ProxyLogger(config);
        this.systemProxyManager = new system_proxy_1.SystemProxyManager(this.logger);
        this.app = (0, express_1.default)();
        this.server = http.createServer(this.app);
        this.setupMiddleware();
        this.setupRoutes();
        this.setupHttpsProxy();
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
        // API-based forwarding
        this.app.use('/proxy/forward', (0, http_proxy_middleware_1.createProxyMiddleware)(proxyOptions));
        // Catch-all proxy for system proxy usage
        const systemProxyOptions = {
            target: undefined,
            changeOrigin: true,
            router: (req) => {
                // Skip proxy routes
                if (req.url.startsWith('/proxy/')) {
                    return undefined;
                }
                // Extract target URL from request
                const host = req.headers.host;
                const protocol = req.headers['x-forwarded-proto'] || 'http';
                if (!host) {
                    throw new Error('No host header found');
                }
                return `${protocol}://${host}`;
            },
            onError: (err, req, res) => {
                this.logger.error('System proxy error', { error: err.message, url: req.url });
                if (res && !res.headersSent) {
                    res.status(502).end();
                }
            },
            onProxyReq: (proxyReq, req, res) => {
                this.logger.debug('System proxying request', {
                    method: req.method,
                    url: req.url,
                    host: req.headers.host
                });
            }
        };
        // Apply system proxy middleware to all non-proxy routes
        this.app.use((req, res, next) => {
            if (req.url.startsWith('/proxy/')) {
                next();
            }
            else {
                (0, http_proxy_middleware_1.createProxyMiddleware)(systemProxyOptions)(req, res, next);
            }
        });
    }
    setupHttpsProxy() {
        // Handle CONNECT requests for HTTPS tunneling
        this.server.on('connect', (request, clientSocket, head) => {
            const transactionId = (0, uuid_1.v4)();
            const url = request.url || '';
            const [hostname, port] = url.split(':');
            const targetPort = parseInt(port) || 443;
            this.logger.debug('HTTPS CONNECT request', {
                transactionId,
                hostname,
                port: targetPort,
                url
            });
            // Log the CONNECT request
            const requestLog = {
                timestamp: new Date().toISOString(),
                method: 'CONNECT',
                url: url,
                headers: request.headers,
                body: undefined,
                sourceIp: clientSocket.remoteAddress || 'unknown',
                userAgent: request.headers['user-agent']
            };
            const transaction = {
                id: transactionId,
                request: requestLog
            };
            this.transactions.set(transactionId, transaction);
            // Create connection to target server
            const serverSocket = new net.Socket();
            serverSocket.connect(targetPort, hostname, () => {
                // Send 200 Connection Established response
                clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
                // Log successful connection
                const responseLog = {
                    timestamp: new Date().toISOString(),
                    statusCode: 200,
                    headers: {},
                    body: 'Connection Established',
                    responseTime: Date.now() - new Date(requestLog.timestamp).getTime()
                };
                transaction.response = responseLog;
                this.logger.logTransaction(transaction);
                this.transactions.delete(transactionId);
                // Pipe data between client and server
                serverSocket.pipe(clientSocket);
                clientSocket.pipe(serverSocket);
            });
            serverSocket.on('error', (err) => {
                this.logger.error('HTTPS tunnel error', {
                    transactionId,
                    hostname,
                    port: targetPort,
                    error: err.message
                });
                // Log failed connection
                const responseLog = {
                    timestamp: new Date().toISOString(),
                    statusCode: 502,
                    headers: {},
                    body: `Tunnel Error: ${err.message}`,
                    responseTime: Date.now() - new Date(requestLog.timestamp).getTime()
                };
                transaction.response = responseLog;
                this.logger.logTransaction(transaction);
                this.transactions.delete(transactionId);
                clientSocket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n');
            });
            clientSocket.on('error', (err) => {
                this.logger.error('Client socket error in HTTPS tunnel', {
                    transactionId,
                    error: err.message
                });
                serverSocket.destroy();
            });
            serverSocket.on('close', () => {
                clientSocket.end();
            });
            clientSocket.on('close', () => {
                serverSocket.destroy();
            });
        });
    }
    start() {
        return new Promise((resolve, reject) => {
            try {
                this.server.listen(this.config.port, this.config.host, () => {
                    this.logger.info(`Local proxy started`, {
                        host: this.config.host,
                        port: this.config.port,
                        logLevel: this.config.logLevel,
                        httpsSupport: true
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