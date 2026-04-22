"""Run the mock server programmatically to avoid uvicorn import resolution issues.
Usage: python run_mock_server.py
"""
import uvicorn
import sys

# Ensure repo root is in path
from pathlib import Path
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

# Import the app
from tools import mock_server

if __name__ == '__main__':
    print("🚀 Starting mock server on http://127.0.0.1:8025")
    uvicorn.run(mock_server.app, host='127.0.0.1', port=8025, reload=False)
