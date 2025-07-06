#!/bin/bash

# Local Proxy Installation Script for macOS
# This script installs the local proxy as a system service

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SERVICE_NAME="local-proxy"
PLIST_NAME="com.localproxy.service"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"
INSTALL_DIR="/usr/local/lib/local-proxy"
BIN_DIR="/usr/local/bin"
LOG_DIR="/usr/local/var/log/local-proxy"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_requirements() {
    print_status "Checking requirements..."
    
    # Check for Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js first."
        exit 1
    fi
    
    # Check for npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    # Check Node.js version
    node_version=$(node --version | cut -d'v' -f2)
    min_version="16.0.0"
    if [ "$(printf '%s\n' "$min_version" "$node_version" | sort -V | head -n1)" != "$min_version" ]; then
        print_error "Node.js version $node_version is too old. Minimum required: $min_version"
        exit 1
    fi
    
    print_status "Requirements check passed"
}

install_dependencies() {
    print_status "Installing dependencies..."
    cd "$PROJECT_DIR"
    npm install
    npm run build
    print_status "Dependencies installed and project built"
}

create_directories() {
    print_status "Creating directories..."
    
    # Create install directory
    sudo mkdir -p "$INSTALL_DIR"
    sudo mkdir -p "$LOG_DIR"
    sudo mkdir -p "$BIN_DIR"
    
    # Set permissions
    sudo chown -R "$USER":staff "$INSTALL_DIR"
    sudo chown -R "$USER":staff "$LOG_DIR"
    
    print_status "Directories created"
}

copy_files() {
    print_status "Copying files..."
    
    # Copy built application
    sudo cp -r "$PROJECT_DIR/dist"/* "$INSTALL_DIR/"
    sudo cp -r "$PROJECT_DIR/node_modules" "$INSTALL_DIR/"
    sudo cp "$PROJECT_DIR/package.json" "$INSTALL_DIR/"
    
    # Copy scripts
    sudo cp -r "$PROJECT_DIR/scripts" "$INSTALL_DIR/"
    sudo chmod +x "$INSTALL_DIR/scripts"/*.sh
    
    # Create symlink for CLI
    sudo ln -sf "$INSTALL_DIR/index.js" "$BIN_DIR/local-proxy"
    sudo chmod +x "$BIN_DIR/local-proxy"
    
    print_status "Files copied"
}

create_launchd_plist() {
    print_status "Creating launchd service..."
    
    NODE_PATH=$(which node)
    
    cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$PLIST_NAME</string>
    <key>ProgramArguments</key>
    <array>
        <string>$NODE_PATH</string>
        <string>$INSTALL_DIR/index.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$INSTALL_DIR</string>
    <key>StandardOutPath</key>
    <string>$LOG_DIR/local-proxy.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/local-proxy.error.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PROXY_PORT</key>
        <string>8080</string>
        <key>PROXY_HOST</key>
        <string>127.0.0.1</string>
        <key>LOG_LEVEL</key>
        <string>info</string>
        <key>LOG_FILE</key>
        <string>$LOG_DIR/transactions.log</string>
    </dict>
    <key>RunAtLoad</key>
    <false/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
EOF
    
    print_status "LaunchAgent plist created at $PLIST_PATH"
}

setup_cli_commands() {
    print_status "Setting up CLI commands..."
    
    # Create wrapper script for proxy management with DNS integration
    sudo cp "$SCRIPT_DIR/proxyctl" "$BIN_DIR/proxyctl"
    
    sudo chmod +x "$BIN_DIR/proxyctl"
    print_status "CLI commands set up"
}

main() {
    echo "Local Proxy Installation Script"
    echo "==============================="
    echo ""
    
    check_requirements
    install_dependencies
    create_directories
    copy_files
    create_launchd_plist
    setup_cli_commands
    
    echo ""
    print_status "Installation completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Start the service: proxyctl start"
    echo "2. Enable system proxy: proxyctl enable-proxy"
    echo "3. Check status: proxyctl status"
    echo "4. View logs: proxyctl logs"
    echo ""
    echo "The proxy will be available at http://127.0.0.1:8080"
    echo "Web interface: http://127.0.0.1:8080/proxy/status"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    print_error "This script should not be run as root. Please run as a regular user."
    exit 1
fi

main "$@"