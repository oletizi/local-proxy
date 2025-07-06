#!/usr/bin/env node

import { LocalProxy } from './proxy';
import { loadConfig, validateConfig } from './config';

async function main() {
  try {
    const config = loadConfig();
    validateConfig(config);

    const proxy = new LocalProxy(config);

    process.on('SIGINT', () => {
      console.log('\nReceived SIGINT, shutting down gracefully...');
      proxy.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\nReceived SIGTERM, shutting down gracefully...');
      proxy.stop();
      process.exit(0);
    });

    await proxy.start();
  } catch (error) {
    console.error('Failed to start proxy:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}