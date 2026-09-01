"""Install runtime dependencies and print pip's full output for DirectAdmin."""

from pathlib import Path
import subprocess
import sys


project_root = Path(__file__).resolve().parent
result = subprocess.run(
    [sys.executable, "-m", "pip", "install", "--upgrade", "-r", str(project_root / "requirements.txt")],
    cwd=project_root,
    text=True,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
)
print(result.stdout)
raise SystemExit(result.returncode)
