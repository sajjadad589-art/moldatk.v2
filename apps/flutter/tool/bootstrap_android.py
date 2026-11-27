"""Generate Android platform sources using the installed, pinned Flutter SDK.

Run from any directory. No credentials, production connections or publishing.
Existing Android sources are never overwritten.
"""
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "android"
flutter = shutil.which("flutter")
if not flutter:
    raise SystemExit("Install Flutter and add it to PATH first.")
if DEST.exists():
    raise SystemExit("Android directory already exists; refusing to overwrite.")

with tempfile.TemporaryDirectory() as temp:
    generated = Path(temp) / "app"
    subprocess.run([
        flutter, "create", "--no-pub", "--platforms=android",
        "--org", "com.mwaldatk", "--project-name", "app", str(generated),
    ], check=True)
    android = generated / "android"
    gradle = android / "app" / "build.gradle.kts"
    if not gradle.is_file():
        raise SystemExit("Unexpected Flutter Android template; review manually.")
    source = gradle.read_text(encoding="utf-8")
    if 'applicationId = "com.mwaldatk.app"' not in source:
        raise SystemExit("Unexpected package identity.")
    marker = "buildTypes {"
    if source.count(marker) != 1:
        raise SystemExit("Unexpected Android build types; review manually.")
    source = source.replace(marker, marker + '\n        getByName("debug") {\n            applicationIdSuffix = ".dev"\n        }', 1)
    gradle.write_text(source, encoding="utf-8")
    shutil.copytree(android, DEST)
print("Generated Android platform. Debug ID: com.mwaldatk.app.dev.")
