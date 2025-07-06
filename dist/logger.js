"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProxyLogger = void 0;
const fs_1 = require("fs");
class ProxyLogger {
    constructor(config) {
        this.config = config;
        if (config.logFile) {
            this.logStream = (0, fs_1.createWriteStream)(config.logFile, { flags: 'a' });
        }
    }
    log(level, message, data) {
        if (!this.shouldLog(level))
            return;
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            ...(data && { data })
        };
        const logLine = JSON.stringify(logEntry) + '\n';
        if (this.logStream) {
            this.logStream.write(logLine);
        }
        if (this.config.logLevel !== 'silent') {
            console.log(logLine.trim());
        }
    }
    logTransaction(transaction) {
        this.log('info', 'HTTP Transaction', transaction);
    }
    error(message, error) {
        this.log('error', message, error);
    }
    warn(message, data) {
        this.log('warn', message, data);
    }
    info(message, data) {
        this.log('info', message, data);
    }
    debug(message, data) {
        this.log('debug', message, data);
    }
    shouldLog(level) {
        const levels = ['silent', 'error', 'warn', 'info', 'debug'];
        const configLevel = levels.indexOf(this.config.logLevel);
        const messageLevel = levels.indexOf(level);
        return messageLevel <= configLevel && configLevel > 0;
    }
    close() {
        if (this.logStream) {
            this.logStream.end();
        }
    }
}
exports.ProxyLogger = ProxyLogger;
//# sourceMappingURL=logger.js.map