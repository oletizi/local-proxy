# Local Proxy for macOS

A TypeScript-based local network proxy that intercepts, logs, and forwards web requests. Designed for macOS with system integration support.

## Features

- **HTTP/HTTPS Proxy**: Intercepts and forwards web requests
- **Transaction Logging**: Comprehensive logging of requests and responses
- **System Integration**: Automatic macOS system proxy configuration
- **LaunchAgent Service**: Runs as a background service
- **Web Interface**: REST API for monitoring and control
- **CLI Management**: Command-line tools for easy management

## Quick Start

### Installation

```bash
# Clone and install
git clone <repository-url>
cd local-proxy
./scripts/install.sh
```

### Basic Usage

```bash
# Start the proxy service
proxyctl start

# Enable system proxy (routes all traffic through the proxy)
proxyctl enable-proxy

# Check status
proxyctl status

# View live logs
proxyctl logs

# Disable system proxy
proxyctl disable-proxy

# Stop the service
proxyctl stop
```

## API Endpoints

### Management
- `GET /proxy/status` - Service status and configuration
- `GET /proxy/logs` - Active transaction logs
- `GET /proxy/system-settings` - Current macOS proxy settings

### System Proxy Control
- `POST /proxy/system-enable` - Enable system proxy
- `POST /proxy/system-disable` - Disable system proxy

### Traffic Forwarding
- `POST /proxy/forward/*` - Forward requests (set `x-target-url` header)

## Configuration

### Environment Variables

```bash
PROXY_PORT=8080           # Proxy server port
PROXY_HOST=127.0.0.1      # Proxy server host
LOG_LEVEL=info            # Logging level (silent|error|warn|info|debug)
LOG_FILE=./proxy.log      # Log file path
ENABLE_HTTPS=false        # Enable HTTPS proxy
HTTPS_PORT=8443           # HTTPS proxy port
```

### Configuration File

Copy `.env.example` to `.env` and modify as needed:

```bash
cp .env.example .env
```

## CLI Commands

### Service Management
```bash
proxyctl start      # Start proxy service
proxyctl stop       # Stop proxy service
proxyctl restart    # Restart proxy service
proxyctl status     # Show service status
```

### System Proxy Control
```bash
proxyctl enable-proxy    # Configure system to use proxy
proxyctl disable-proxy   # Remove system proxy configuration
proxyctl proxy-status    # Show current proxy settings
```

### Monitoring
```bash
proxyctl logs       # Show live transaction logs
```

## Manual Usage

### Development Mode
```bash
npm install
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

## System Integration

The proxy integrates with macOS system settings by:

1. **Network Configuration**: Automatically configures HTTP/HTTPS proxy settings for all network services
2. **LaunchAgent Service**: Runs as a user-level daemon service
3. **Settings Backup**: Backs up existing proxy settings before making changes
4. **Graceful Restoration**: Restores original settings when disabled

## Security Considerations

- Proxy runs on localhost (127.0.0.1) by default
- Logs may contain sensitive information - secure log files appropriately
- System proxy changes require administrator privileges
- Service runs with user-level permissions (not root)

## Troubleshooting

### Service Won't Start
```bash
# Check if port is available
lsof -i :8080

# Check service logs
tail -f /usr/local/var/log/local-proxy/local-proxy.log
```

### Proxy Configuration Issues
```bash
# Check current proxy settings
proxyctl proxy-status

# Manually disable system proxy
sudo ./scripts/proxy-config.sh disable

# Restore from backup
ls scripts/proxy-backup-*.json
```

### Permission Issues
```bash
# Ensure proper permissions
ls -la /usr/local/lib/local-proxy
ls -la /usr/local/bin/local-proxy*
```

## Uninstallation

```bash
./scripts/uninstall.sh
```

This will:
- Stop the proxy service
- Disable system proxy configuration
- Remove all installed files
- Optionally remove log files and backups

## Development

### Project Structure
```
src/
├── index.ts          # Main entry point
├── proxy.ts          # Core proxy server
├── logger.ts         # Logging functionality
├── system-proxy.ts   # macOS system integration
├── config.ts         # Configuration management
└── types.ts          # TypeScript definitions

scripts/
├── install.sh        # Installation script
├── uninstall.sh      # Uninstallation script
└── proxy-config.sh   # System proxy configuration
```

### Building
```bash
npm run build      # Compile TypeScript
npm run lint       # Run linter
npm run typecheck  # Type checking
```

## License

MIT License