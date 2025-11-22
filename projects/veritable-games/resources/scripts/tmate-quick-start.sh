#!/bin/bash

# tmate Quick Start Script
# Usage: ./tmate-quick-start.sh [option]
# Options: start, stop, status, help

set -e

OPTION=${1:-start}

case "$OPTION" in
    start)
        echo "🚀 Starting tmate session..."
        tmate -F &
        sleep 1
        echo ""
        echo "📋 Sharing URLs:"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        tmate show-messages 2>/dev/null || echo "tmate is starting, try again in 2 seconds"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "✅ tmate is running in background"
        echo "📝 Share the URLs above with your team"
        echo "🛑 Stop with: ./tmate-quick-start.sh stop"
        ;;
    
    stop)
        echo "🛑 Stopping tmate..."
        killall tmate 2>/dev/null && echo "✅ tmate stopped" || echo "⚠️  tmate not running"
        ;;
    
    status)
        echo "📊 tmate Status:"
        if pgrep -x tmate > /dev/null; then
            echo "✅ tmate is running"
            echo ""
            echo "📋 Sharing URLs:"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            tmate show-messages 2>/dev/null || echo "Unable to retrieve URLs"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo ""
            echo "🔗 Clients connected:"
            tmate list-clients 2>/dev/null | head -5 || echo "No clients"
        else
            echo "❌ tmate is NOT running"
            echo "Start with: ./tmate-quick-start.sh start"
        fi
        ;;
    
    help)
        echo "tmate Quick Start Script"
        echo ""
        echo "Usage: ./tmate-quick-start.sh [option]"
        echo ""
        echo "Options:"
        echo "  start      Start tmate session and show sharing URLs"
        echo "  stop       Stop tmate session"
        echo "  status     Show tmate status and URLs"
        echo "  help       Show this help message"
        echo ""
        echo "Examples:"
        echo "  # Start sharing terminal"
        echo "  ./tmate-quick-start.sh start"
        echo ""
        echo "  # Check status"
        echo "  ./tmate-quick-start.sh status"
        echo ""
        echo "  # Stop sharing"
        echo "  ./tmate-quick-start.sh stop"
        echo ""
        echo "Read the full guide:"
        echo "  cat ~/tmate-setup-guide.md"
        ;;
    
    *)
        echo "❌ Unknown option: $OPTION"
        echo "Use './tmate-quick-start.sh help' for help"
        exit 1
        ;;
esac
