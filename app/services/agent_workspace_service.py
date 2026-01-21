"""
Agent Workspace Service

Handles workspace operations for generated agent code:
- Virtual environment creation
- Dependency installation
- Workspace management
"""
import os
import subprocess
import json
from typing import Dict, Any, List, Optional
from pathlib import Path
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent_run_log import AgentRunLog


class AgentWorkspaceService:
    """Service for managing agent workspace and virtual environments."""

    def __init__(self, session: AsyncSession, agent_id: str, agent_name: str):
        """
        Initialize the workspace service.

        Args:
            session: Database session for logging
            agent_id: Agent UUID
            agent_name: Agent name (used for workspace directory)
        """
        self.session = session
        self.agent_id = agent_id
        self.agent_name = agent_name
        self.openmanus_path = os.getenv("OPENMANUS_PATH", "./OpenManus")
        self.workspace_dir = os.path.join(
            self.openmanus_path,
            "workspace",
            self._sanitize_name(agent_name)
        )

    def _sanitize_name(self, name: str) -> str:
        """Sanitize agent name for directory usage."""
        import re
        sanitized = re.sub(r'[^\w\s-]', '', name)
        sanitized = re.sub(r'[-\s]+', '_', sanitized)
        return sanitized.strip('_')

    async def _log(self, loop_count: int, stage: str, status: str, message: str):
        """Log a workspace operation."""
        import uuid
        log = AgentRunLog(
            agent_id=uuid.UUID(self.agent_id) if isinstance(self.agent_id, str) else self.agent_id,
            loop_count=loop_count,
            stage=stage,
            status=status,
            message=message
        )
        self.session.add(log)
        await self.session.commit()

    async def setup_virtual_environment(
        self,
        loop_count: int = 0,
        python_path: str = "python3"
    ) -> Dict[str, Any]:
        """
        Create virtual environment and install dependencies.

        Args:
            loop_count: Current loop iteration count
            python_path: Python executable path

        Returns:
            Dict with success status and logs
        """
        results = {
            "success": False,
            "venv_created": False,
            "dependencies_installed": False,
            "logs": []
        }

        # Ensure workspace directory exists
        os.makedirs(self.workspace_dir, exist_ok=True)

        venv_dir = os.path.join(self.workspace_dir, "venv")
        requirements_file = os.path.join(self.workspace_dir, "requirements.txt")

        # Step 1: Create virtual environment
        await self._log(
            loop_count,
            "venv_setup",
            "running",
            f"Creating virtual environment at {venv_dir}"
        )

        try:
            result = subprocess.run(
                [python_path, "-m", "venv", venv_dir],
                capture_output=True,
                text=True,
                timeout=120
            )

            if result.returncode == 0:
                results["venv_created"] = True
                results["logs"].append({
                    "stage": "venv_creation",
                    "status": "success",
                    "output": result.stdout
                })
                await self._log(
                    loop_count,
                    "venv_setup",
                    "success",
                    f"Virtual environment created successfully"
                )
            else:
                results["logs"].append({
                    "stage": "venv_creation",
                    "status": "error",
                    "error": result.stderr
                })
                await self._log(
                    loop_count,
                    "venv_setup",
                    "error",
                    f"Failed to create venv: {result.stderr}"
                )
                return results
        except subprocess.TimeoutExpired:
            await self._log(
                loop_count,
                "venv_setup",
                "error",
                "Virtual environment creation timed out"
            )
            return results
        except Exception as e:
            await self._log(
                loop_count,
                "venv_setup",
                "error",
                f"Failed to create venv: {str(e)}"
            )
            return results

        # Step 2: Install dependencies
        if os.path.exists(requirements_file):
            await self._log(
                loop_count,
                "venv_setup",
                "running",
                "Installing/Upgrading dependencies from requirements.txt"
            )

            # Determine pip path based on OS
            if os.name == 'nt':  # Windows
                pip_path = os.path.join(venv_dir, "Scripts", "pip")
            else:  # Unix-like
                pip_path = os.path.join(venv_dir, "bin", "pip")

            try:
                # Use --upgrade to ensure latest versions are installed
                # This handles updated requirements.txt files
                result = subprocess.run(
                    [pip_path, "install", "--upgrade", "-r", requirements_file],
                    capture_output=True,
                    text=True,
                    timeout=300  # 5 minutes timeout
                )

                if result.returncode == 0:
                    results["dependencies_installed"] = True
                    results["logs"].append({
                        "stage": "dependency_installation",
                        "status": "success",
                        "output": result.stdout
                    })
                    await self._log(
                        loop_count,
                        "venv_setup",
                        "success",
                        "Dependencies installed successfully"
                    )
                else:
                    results["logs"].append({
                        "stage": "dependency_installation",
                        "status": "error",
                        "error": result.stderr
                    })
                    await self._log(
                        loop_count,
                        "venv_setup",
                        "error",
                        f"Failed to install dependencies: {result.stderr}"
                    )
            except subprocess.TimeoutExpired:
                await self._log(
                    loop_count,
                    "venv_setup",
                    "error",
                    "Dependency installation timed out"
                )
            except Exception as e:
                await self._log(
                    loop_count,
                    "venv_setup",
                    "error",
                    f"Failed to install dependencies: {str(e)}"
                )

        results["success"] = results["venv_created"] and results["dependencies_installed"]
        return results

    async def get_python_executable(self) -> str:
        """
        Get the Python executable path from the virtual environment.

        Returns:
            Path to python executable in venv, or system python if venv doesn't exist
        """
        venv_dir = os.path.join(self.workspace_dir, "venv")

        if os.name == 'nt':  # Windows
            python_path = os.path.join(venv_dir, "Scripts", "python.exe")
        else:  # Unix-like
            python_path = os.path.join(venv_dir, "bin", "python")

        if os.path.exists(python_path):
            return python_path

        # Fallback to system python
        return "python3"

    async def write_env_file(self, env_vars: Dict[str, str]) -> str:
        """
        Write environment variables to .env file in workspace.

        Args:
            env_vars: Dictionary of environment variables

        Returns:
            Path to the created .env file
        """
        env_file = os.path.join(self.workspace_dir, ".env")

        env_lines = []
        for key, value in env_vars.items():
            # Quote values that contain spaces or special characters
            if ' ' in value or ';' in value or '&' in value:
                value = f'"{value}"'
            env_lines.append(f"{key}={value}")

        with open(env_file, 'w') as f:
            f.write('\n'.join(env_lines))

        return env_file

    async def get_setup_logs(self, loop_count: int = 0) -> List[Dict[str, Any]]:
        """
        Get logs for workspace setup operations.

        Args:
            loop_count: Filter by loop count (0 for all)

        Returns:
            List of log entries
        """
        from sqlalchemy import select
        from app.models.agent_run_log import AgentRunLog

        query = select(AgentRunLog).where(
            AgentRunLog.agent_id == self.agent_id,
            AgentRunLog.stage == "venv_setup"
        )

        if loop_count > 0:
            query = query.where(AgentRunLog.loop_count == loop_count)

        query = query.order_by(AgentRunLog.created_at)

        result = await self.session.execute(query)
        logs = result.scalars().all()

        return [
            {
                "id": str(log.id),
                "loop_count": log.loop_count,
                "stage": log.stage,
                "status": log.status,
                "message": log.message,
                "created_at": log.created_at.isoformat()
            }
            for log in logs
        ]

    async def cleanup(self, keep_code: bool = True):
        """
        Clean up workspace artifacts.

        Args:
            keep_code: If True, keep generated code, only remove venv and logs
        """
        import shutil

        venv_dir = os.path.join(self.workspace_dir, "venv")

        if os.path.exists(venv_dir):
            shutil.rmtree(venv_dir)

        if not keep_code:
            if os.path.exists(self.workspace_dir):
                shutil.rmtree(self.workspace_dir)
