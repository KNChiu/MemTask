"""
MemTask Dashboard - FastAPI Backend
Provides API endpoints for goals, tasks, and memories data
"""

import os
import json
import argparse
from pathlib import Path
from typing import List, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware


def parse_args():
    """
    Parse command line arguments
    """
    parser = argparse.ArgumentParser(
        description="MemTask Dashboard - FastAPI Backend",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py --data-dir /path/to/data
  python main.py --data-dir /path/to/data --verbose
  python main.py -v
        """
    )

    parser.add_argument(
        "--data-dir",
        type=str,
        help="Path to the data directory containing goals, tasks, and memories (default: MCP_DATA_DIR env var or '../mcp_data')"
    )

    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose output"
    )

    return parser.parse_args()


def get_configuration():
    """
    Get configuration from command line args, environment variables, and defaults
    Priority: CLI args > environment variables > defaults
    """
    args = parse_args()

    # Determine data directory (CLI arg > env var > default)
    if args.data_dir:
        data_dir = Path(args.data_dir)
    else:
        data_dir = Path(os.getenv("MCP_DATA_DIR", "../mcp_data"))

    # Get port from environment variable
    port = int(os.getenv("PORT", 8000))

    return {
        "data_dir": data_dir,
        "port": port,
        "verbose": args.verbose
    }


# Get configuration
config = get_configuration()
DATA_DIR = config["data_dir"]
STATIC_DIR = Path(__file__).parent / "static"

app = FastAPI(
    title="MemTask Dashboard API",
    description="Local-first dashboard for MemTask goal, task, and memory visualization",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def read_json_files(directory: Path) -> List[Dict[str, Any]]:
    """
    Read all JSON files from a directory and return their contents as a list
    """
    if not directory.exists():
        return []

    data = []
    try:
        json_files = list(directory.glob("*.json"))
        for file_path in json_files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = json.load(f)
                    data.append(content)
            except json.JSONDecodeError as e:
                print(f"Error reading {file_path}: {e}")
            except Exception as e:
                print(f"Error processing {file_path}: {e}")
    except Exception as e:
        print(f"Error reading directory {directory}: {e}")

    return data


@app.get("/api/goals", response_model=List[Dict[str, Any]])
async def get_goals():
    """
    Get all goals from the data directory
    """
    try:
        goals_dir = DATA_DIR / "goals"
        goals = read_json_files(goals_dir)
        return goals
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load goals: {str(e)}")


@app.get("/api/tasks", response_model=List[Dict[str, Any]])
async def get_tasks():
    """
    Get all tasks from the data directory
    """
    try:
        tasks_dir = DATA_DIR / "tasks"
        tasks = read_json_files(tasks_dir)
        return tasks
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load tasks: {str(e)}")


@app.get("/api/memories", response_model=List[Dict[str, Any]])
async def get_memories():
    """
    Get all memories from the data directory
    """
    try:
        memories_dir = DATA_DIR / "memories"
        memories = read_json_files(memories_dir)
        return memories
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load memories: {str(e)}")


@app.get("/api/health")
async def health_check():
    """
    Health check endpoint
    """
    return {
        "status": "healthy",
        "data_directory": str(DATA_DIR),
        "directories_exist": {
            "goals": (DATA_DIR / "goals").exists(),
            "tasks": (DATA_DIR / "tasks").exists(),
            "memories": (DATA_DIR / "memories").exists()
        }
    }


@app.get("/")
async def root():
    """
    Serve the main HTML file
    """
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    else:
        return JSONResponse(
            status_code=404,
            content={"error": "index.html not found in static directory"}
        )


# Mount static files (must be after route definitions to avoid conflicts)
app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")


def print_startup_info(config: dict, verbose: bool = False):
    """
    Print startup information
    """
    port = config["port"]
    data_dir = config["data_dir"]

    print(f"Starting MemTask Dashboard server at http://localhost:{port}/")
    print(f"Data directory: {data_dir}")

    if verbose:
        print(f"Static files directory: {STATIC_DIR}")
        print(f"Configuration source priority: CLI args > env vars > defaults")

        # Check data directory structure
        subdirs = ["goals", "tasks", "memories"]
        print(f"Data directory structure:")
        for subdir in subdirs:
            subdir_path = data_dir / subdir
            exists = subdir_path.exists()
            status = "✓" if exists else "✗"
            print(f"  {status} {subdir_path}")

            if exists and verbose:
                json_files = list(subdir_path.glob("*.json"))
                print(f"    -> {len(json_files)} JSON files found")

    print(f"API documentation: http://localhost:{port}/docs")
    print("")  # Empty line for better readability


if __name__ == "__main__":
    import uvicorn

    # Print startup information
    print_startup_info(config, config["verbose"])

    # Start the server
    uvicorn.run(app, host="0.0.0.0", port=config["port"])
