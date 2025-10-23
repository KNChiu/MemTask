#!/bin/bash

# MemTask Dashboard - FastAPI Startup Script

# Function to show help
show_help() {
    echo "MemTask Dashboard - FastAPI Startup Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --data-dir <path>     Specify data directory path"
    echo "  --verbose, -v         Enable verbose output"
    echo "  --help, -h            Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  MCP_DATA_DIR         Data directory path (default: ../mcp_data)"
    echo "  PORT                 Server port (default: 8000)"
    echo ""
    echo "Examples:"
    echo "  $0                               # Use default settings"
    echo "  $0 --data-dir /path/to/data     # Specify data directory"
    echo "  $0 --data-dir /path/to/data -v  # With verbose output"
    echo ""
}

# Parse command line arguments
PYTHON_ARGS=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --data-dir)
            PYTHON_ARGS="$PYTHON_ARGS --data-dir $2"
            shift 2
            ;;
        --verbose|-v)
            PYTHON_ARGS="$PYTHON_ARGS --verbose"
            shift
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Set default environment variables if not set
# These will be used as fallbacks if CLI args are not provided
if [ -z "$MCP_DATA_DIR" ]; then
    export MCP_DATA_DIR="../mcp_data"
fi

if [ -z "$PORT" ]; then
    export PORT=8000
fi

echo "Starting MemTask Dashboard..."
echo "Environment: PORT=${PORT}, MCP_DATA_DIR=${MCP_DATA_DIR}"
if [ -n "$PYTHON_ARGS" ]; then
    echo "CLI Arguments:${PYTHON_ARGS}"
fi
echo ""

# Start the server with arguments
uv run python main.py $PYTHON_ARGS
