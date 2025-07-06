import { createWriteStream, WriteStream } from 'fs';
import { TransactionLog, ProxyConfig } from './types';

export class ProxyLogger {
  private logStream?: WriteStream;
  private config: ProxyConfig;

  constructor(config: ProxyConfig) {
    this.config = config;
    if (config.logFile) {
      this.logStream = createWriteStream(config.logFile, { flags: 'a' });
    }
  }

  log(level: string, message: string, data?: any): void {
    if (!this.shouldLog(level)) return;

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

  logTransaction(transaction: TransactionLog): void {
    this.log('info', 'HTTP Transaction', transaction);
  }

  error(message: string, error?: any): void {
    this.log('error', message, error);
  }

  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  private shouldLog(level: string): boolean {
    const levels = ['silent', 'error', 'warn', 'info', 'debug'];
    const configLevel = levels.indexOf(this.config.logLevel);
    const messageLevel = levels.indexOf(level);
    return messageLevel <= configLevel && configLevel > 0;
  }

  close(): void {
    if (this.logStream) {
      this.logStream.end();
    }
  }
}