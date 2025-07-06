#!/bin/bash

# macOS Proxy Configuration Script
# Configures system proxy settings to route through local proxy

PROXY_HOST="127.0.0.1"
PROXY_PORT="8080"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

get_network_services() {
    networksetup -listallnetworkservices | grep -v "^An asterisk" | grep -v "^\*"
}

enable_proxy() {
    echo "Enabling proxy for all network services..."
    
    # Get services and process them
    get_network_services | while read -r service; do
        if [[ -n "$service" ]]; then
            echo "Configuring proxy for: [$service]"
            
            # Set HTTP proxy
            if networksetup -setwebproxy "$service" "$PROXY_HOST" "$PROXY_PORT" 2>/dev/null; then
                echo "  ✓ HTTP proxy set"
            else
                echo "  ✗ Failed to set HTTP proxy"
            fi
            
            if networksetup -setwebproxystate "$service" on 2>/dev/null; then
                echo "  ✓ HTTP proxy enabled"
            else
                echo "  ✗ Failed to enable HTTP proxy"
            fi
            
            # Set HTTPS proxy
            if networksetup -setsecurewebproxy "$service" "$PROXY_HOST" "$PROXY_PORT" 2>/dev/null; then
                echo "  ✓ HTTPS proxy set"
            else
                echo "  ✗ Failed to set HTTPS proxy"
            fi
            
            if networksetup -setsecurewebproxystate "$service" on 2>/dev/null; then
                echo "  ✓ HTTPS proxy enabled"
            else
                echo "  ✗ Failed to enable HTTPS proxy"
            fi
            
            echo ""
        fi
    done
    
    echo "Proxy configuration completed!"
    echo "HTTP/HTTPS traffic will be routed through $PROXY_HOST:$PROXY_PORT"
}

disable_proxy() {
    echo "Disabling proxy for all network services..."
    
    while IFS= read -r service; do
        echo "Removing proxy for: $service"
        
        # Disable HTTP proxy
        networksetup -setwebproxystate "$service" off 2>/dev/null || echo "  Warning: Failed to disable HTTP proxy for $service"
        
        # Disable HTTPS proxy
        networksetup -setsecurewebproxystate "$service" off 2>/dev/null || echo "  Warning: Failed to disable HTTPS proxy for $service"
        
        # Disable FTP proxy
        networksetup -setftpproxystate "$service" off 2>/dev/null || echo "  Warning: Failed to disable FTP proxy for $service"
        
        # Disable SOCKS proxy
        networksetup -setsocksfirewallproxystate "$service" off 2>/dev/null || echo "  Warning: Failed to disable SOCKS proxy for $service"
        
    done < <(get_network_services)
    
    echo "Proxy configuration removed!"
}

status_proxy() {
    echo "Current proxy status:"
    echo "===================="
    
    while IFS= read -r service; do
        echo "Service: $service"
        
        # Check HTTP proxy
        http_status=$(networksetup -getwebproxy "$service" 2>/dev/null)
        if echo "$http_status" | grep -q "Enabled: Yes"; then
            echo "  HTTP Proxy: Enabled"
            echo "$http_status" | grep "Server:" | sed 's/^/  /'
            echo "$http_status" | grep "Port:" | sed 's/^/  /'
        else
            echo "  HTTP Proxy: Disabled"
        fi
        
        # Check HTTPS proxy
        https_status=$(networksetup -getsecurewebproxy "$service" 2>/dev/null)
        if echo "$https_status" | grep -q "Enabled: Yes"; then
            echo "  HTTPS Proxy: Enabled"
            echo "$https_status" | grep "Server:" | sed 's/^/  /'
            echo "$https_status" | grep "Port:" | sed 's/^/  /'
        else
            echo "  HTTPS Proxy: Disabled"
        fi
        
        echo ""
    done < <(get_network_services)
}

backup_proxy_settings() {
    echo "Backing up current proxy settings..."
    backup_file="$SCRIPT_DIR/proxy-backup-$(date +%Y%m%d-%H%M%S).txt"
    
    echo "# Proxy Backup - $(date)" > "$backup_file"
    echo "# Use restore_proxy_settings() to restore" >> "$backup_file"
    echo "" >> "$backup_file"
    
    while IFS= read -r service; do
        echo "# Service: $service" >> "$backup_file"
        networksetup -getwebproxy "$service" >> "$backup_file" 2>/dev/null
        networksetup -getsecurewebproxy "$service" >> "$backup_file" 2>/dev/null
        networksetup -getftpproxy "$service" >> "$backup_file" 2>/dev/null
        networksetup -getsocksfirewallproxy "$service" >> "$backup_file" 2>/dev/null
        echo "" >> "$backup_file"
    done < <(get_network_services)
    
    echo "Backup saved to: $backup_file"
}

check_permissions() {
    if [[ $EUID -ne 0 ]]; then
        echo "This script requires administrator privileges."
        echo "Please run with sudo:"
        echo "sudo $0 $*"
        exit 1
    fi
}

show_help() {
    echo "macOS Proxy Configuration Script"
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  enable    Enable proxy for all network services"
    echo "  disable   Disable proxy for all network services"
    echo "  status    Show current proxy status"
    echo "  backup    Backup current proxy settings"
    echo "  help      Show this help message"
    echo ""
    echo "Note: This script requires administrator privileges (sudo)"
}

case "${1:-help}" in
    "enable")
        check_permissions
        backup_proxy_settings
        enable_proxy
        ;;
    "disable")
        check_permissions
        disable_proxy
        ;;
    "status")
        status_proxy
        ;;
    "backup")
        backup_proxy_settings
        ;;
    "help"|*)
        show_help
        ;;
esac