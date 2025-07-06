#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const proxy_1 = require("./proxy");
const config_1 = require("./config");
async function main() {
    try {
        const config = (0, config_1.loadConfig)();
        (0, config_1.validateConfig)(config);
        const proxy = new proxy_1.LocalProxy(config);
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
    }
    catch (error) {
        console.error('Failed to start proxy:', error);
        process.exit(1);
    }
}
if (require.main === module) {
    main();
}
//# sourceMappingURL=index.js.map