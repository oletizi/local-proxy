"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultConfig = void 0;
exports.loadConfig = loadConfig;
exports.validateConfig = validateConfig;
exports.defaultConfig = {
    port: 8080,
    host: 'localhost',
    logLevel: 'info',
    enableHttps: false,
    httpsPort: 8443
};
function loadConfig() {
    const config = { ...exports.defaultConfig };
    if (process.env.PROXY_PORT) {
        config.port = parseInt(process.env.PROXY_PORT, 10);
    }
    if (process.env.PROXY_HOST) {
        config.host = process.env.PROXY_HOST;
    }
    if (process.env.LOG_LEVEL) {
        config.logLevel = process.env.LOG_LEVEL;
    }
    if (process.env.LOG_FILE) {
        config.logFile = process.env.LOG_FILE;
    }
    if (process.env.ENABLE_HTTPS) {
        config.enableHttps = process.env.ENABLE_HTTPS === 'true';
    }
    if (process.env.HTTPS_PORT) {
        config.httpsPort = parseInt(process.env.HTTPS_PORT, 10);
    }
    return config;
}
function validateConfig(config) {
    if (config.port < 1 || config.port > 65535) {
        throw new Error('Port must be between 1 and 65535');
    }
    if (config.httpsPort && (config.httpsPort < 1 || config.httpsPort > 65535)) {
        throw new Error('HTTPS port must be between 1 and 65535');
    }
    if (!['silent', 'error', 'warn', 'info', 'debug'].includes(config.logLevel)) {
        throw new Error('Log level must be one of: silent, error, warn, info, debug');
    }
    if (!config.host) {
        throw new Error('Host is required');
    }
}
//# sourceMappingURL=config.js.map