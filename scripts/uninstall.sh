#!/bin/bash

# Local Proxy Uninstallation Script for macOS
# This script removes the local proxy service and files

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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

stop_service() {
    print_status "Stopping local proxy service..."
    
    if launchctl list | grep -q "$PLIST_NAME"; then
        launchctl unload "$PLIST_PATH" 2>/dev/null || true
        print_status "Service stopped"
    else
        print_status "Service was not running"
    fi
}

disable_system_proxy() {
    print_status "Disabling system proxy..."
    
    if [ -f "$INSTALL_DIR/scripts/proxy-config.sh" ]; then
        sudo "$INSTALL_DIR/scripts/proxy-config.sh" disable
        print_status "System proxy disabled"
    else
        print_warning "Proxy configuration script not found, skipping proxy disable"
    fi
}

remove_launchd_plist() {
    print_status "Removing launchd plist..."
    
    if [ -f "$PLIST_PATH" ]; then
        rm "$PLIST_PATH"
        print_status "LaunchAgent plist removed"
    else
        print_status "LaunchAgent plist not found"
    fi
}

remove_files() {
    print_status "Removing installed files..."
    
    # Remove install directory
    if [ -d "$INSTALL_DIR" ]; then
        sudo rm -rf "$INSTALL_DIR"
        print_status "Installation directory removed"
    fi
    
    # Remove CLI tools
    if [ -f "$BIN_DIR/local-proxy" ]; then
        sudo rm "$BIN_DIR/local-proxy"
        print_status "CLI symlink removed"
    fi
    
    if [ -f "$BIN_DIR/proxyctl" ]; then
        sudo rm "$BIN_DIR/proxyctl"
        print_status "Control script removed"
    fi
    
    # Remove log directory (ask user first)
    if [ -d "$LOG_DIR" ]; then
        echo ""
        read -p "Remove log directory ($LOG_DIR)? [y/N]: " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sudo rm -rf "$LOG_DIR"
            print_status "Log directory removed"
        else
            print_status "Log directory preserved"
        fi
    fi
}

cleanup_backups() {
    print_status "Cleaning up proxy backups..."
    
    backup_dir="$SCRIPT_DIR"
    if [ -d "$backup_dir" ]; then
        # Find and list backup files
        backup_files=$(find "$backup_dir" -name "proxy-backup-*.txt" -o -name "proxy-backup-*.json" 2>/dev/null || true)
        
        if [ -n "$backup_files" ]; then
            echo "Found proxy backup files:"
            echo "$backup_files"
            echo ""
            read -p "Remove proxy backup files? [y/N]: " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                echo "$backup_files" | xargs rm -f
                print_status "Backup files removed"
            else
                print_status "Backup files preserved"
            fi
        else
            print_status "No backup files found"
        fi
    fi
}

main() {
    echo "Local Proxy Uninstallation Script"
    echo "================================="
    echo ""
    
    echo "This will remove the local proxy service and all associated files."
    echo "The following items will be removed:"
    echo "- Service: $PLIST_NAME"
    echo "- Installation directory: $INSTALL_DIR"
    echo "- CLI tools: $BIN_DIR/local-proxy, $BIN_DIR/proxyctl"
    echo "- Log directory: $LOG_DIR (optional)"
    echo ""
    
    read -p "Are you sure you want to continue? [y/N]: " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Uninstallation cancelled"
        exit 0
    fi
    
    echo ""
    stop_service
    disable_system_proxy
    remove_launchd_plist
    remove_files
    cleanup_backups
    
    echo ""
    print_status "Uninstallation completed successfully!"
    echo ""
    echo "The local proxy has been completely removed from your system."
    echo "Your network proxy settings have been restored to their previous state."
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    print_error "This script should not be run as root. Please run as a regular user."
    exit 1
fi

main "$@"