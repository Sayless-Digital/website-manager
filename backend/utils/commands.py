"""Utility helpers for running sudo commands."""

from __future__ import annotations

import subprocess


def run_sudo_command(cmd: str, timeout: int = 30):
    """Run a command with sudo privileges."""
    try:
        if any(token in cmd for token in ('&&', '|', '>', '<', ';')):
            result = subprocess.run(
                ['sudo', 'sh', '-c', cmd],
                capture_output=True,
                text=True,
                timeout=timeout
            )
        else:
            parts = cmd.split()
            result = subprocess.run(
                ['sudo'] + parts,
                capture_output=True,
                text=True,
                timeout=timeout
            )
        return {
            'success': result.returncode == 0,
            'stdout': result.stdout.strip(),
            'stderr': result.stderr.strip()
        }
    except subprocess.TimeoutExpired as err:
        return {'success': False, 'stdout': '', 'stderr': f'Command timed out: {err}'}
    except Exception as err:
        return {'success': False, 'stdout': '', 'stderr': str(err)}



