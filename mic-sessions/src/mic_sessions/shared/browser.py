"""Default local browser MCP shared by the agent providers."""
import shutil
from typing import Any

from mic_sessions.shared.env import get_settings


def playwright_server() -> dict[str, Any]:
    return {
        "command": shutil.which("node") or "node",
        "args": [str(get_settings().agent_browser_directory.resolve() / "mcp.mjs")],
    }
