import express, { Request, Response } from 'express';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import * as http from 'http';
import * as net from 'net';
import * as url from 'url';
import { ProxyConfig, RequestLog, ResponseLog, TransactionLog } from './types';
import { ProxyLogger } from './logger';
import { SystemProxyManager } from './system-proxy';

export class LocalProxy {
  private app: express.Application;
  private server: http.Server;
  private logger: ProxyLogger;
  private config: ProxyConfig;
  private transactions: Map<string, TransactionLog> = new Map();
  private systemProxyManager: SystemProxyManager;

  constructor(config: ProxyConfig) {
    this.config = config;
    this.logger = new ProxyLogger(config);
    this.systemProxyManager = new SystemProxyManager(this.logger);
    this.app = express();
    this.server = http.createServer(this.app);
    this.setupMiddleware();
    this.setupRoutes();
    this.setupHttpsProxy();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    this.app.use((req: Request, res: Response, next) => {
      const transactionId = uuidv4();
      const startTime = Date.now();

      const requestLog: RequestLog = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        headers: req.headers as Record<string, string>,
        body: req.body ? JSON.stringify(req.body) : undefined,
        sourceIp: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent')
      };

      const transaction: TransactionLog = {
        id: transactionId,
        request: requestLog
      };

      this.transactions.set(transactionId, transaction);

      const originalSend = res.send;
      res.send = function(data: any) {
        const responseTime = Date.now() - startTime;
        const responseLog: ResponseLog = {
          timestamp: new Date().toISOString(),
          statusCode: res.statusCode,
          headers: res.getHeaders() as Record<string, string>,
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

  private setupRoutes(): void {
    this.app.get('/proxy/status', (req: Request, res: Response) => {
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

    this.app.get('/proxy/logs', (req: Request, res: Response) => {
      const logs = Array.from(this.transactions.values());
      res.json(logs);
    });

    this.app.get('/proxy/system-settings', async (req: Request, res: Response) => {
      try {
        const settings = await this.systemProxyManager.getCurrentProxySettings();
        res.json(settings);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get system proxy settings' });
      }
    });

    this.app.post('/proxy/system-enable', async (req: Request, res: Response) => {
      try {
        await this.systemProxyManager.enableSystemProxy(this.config.host, this.config.port);
        res.json({ success: true, message: 'System proxy enabled' });
      } catch (error) {
        res.status(500).json({ error: 'Failed to enable system proxy' });
      }
    });

    this.app.post('/proxy/system-disable', async (req: Request, res: Response) => {
      try {
        await this.systemProxyManager.disableSystemProxy();
        res.json({ success: true, message: 'System proxy disabled' });
      } catch (error) {
        res.status(500).json({ error: 'Failed to disable system proxy' });
      }
    });

    const proxyOptions: Options = {
      target: undefined,
      changeOrigin: true,
      router: (req) => {
        const targetUrl = req.headers['x-target-url'] as string || req.url;
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
    this.app.use('/proxy/forward', createProxyMiddleware(proxyOptions));

    // Catch-all proxy for system proxy usage
    const systemProxyOptions: Options = {
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
      } else {
        createProxyMiddleware(systemProxyOptions)(req, res, next);
      }
    });
  }

  private setupHttpsProxy(): void {
    // Handle CONNECT requests for HTTPS tunneling
    this.server.on('connect', (request: http.IncomingMessage, clientSocket: net.Socket, head: Buffer) => {
      const transactionId = uuidv4();
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
      const requestLog: RequestLog = {
        timestamp: new Date().toISOString(),
        method: 'CONNECT',
        url: url,
        headers: request.headers as Record<string, string>,
        body: undefined,
        sourceIp: clientSocket.remoteAddress || 'unknown',
        userAgent: request.headers['user-agent']
      };

      const transaction: TransactionLog = {
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
        const responseLog: ResponseLog = {
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
        const responseLog: ResponseLog = {
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

  start(): Promise<void> {
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
      } catch (error) {
        this.logger.error('Failed to start proxy', error);
        reject(error);
      }
    });
  }

  stop(): void {
    this.logger.info('Stopping proxy server');
    this.logger.close();
  }
}