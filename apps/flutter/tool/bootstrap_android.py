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
    manifest = android / "app" / "src" / "main" / "AndroidManifest.xml"
    xml = manifest.read_text(encoding="utf-8")
    if xml.count("<application") != 1:
        raise SystemExit("Unexpected Android manifest; review manually.")
    xml = xml.replace("<application", '<application android:allowBackup="false"', 1)
    manifest.write_text(xml, encoding="utf-8")
    # Port the existing SUNMI SDK and receipt renderer into the Flutter shell.
    native = ROOT / "tool" / "android_native"
    gradle_source = gradle.read_text(encoding="utf-8")
    gradle.write_text(
        gradle_source + '\n\ndependencies {\n    implementation("com.sunmi:printerlibrary:1.0.18")\n}\n',
        encoding="utf-8",
    )
    xml = manifest.read_text(encoding="utf-8")
    if xml.count("<queries>") != 1:
        raise SystemExit("Unexpected Android queries section; review manually.")
    xml = xml.replace("<queries>", '<queries>\n        <package android:name="woyou.aidlservice.jiuiv5" />', 1)
    manifest.write_text(xml, encoding="utf-8")
    main = android / "app" / "src" / "main"
    java_dest = main / "java" / "com" / "mwaldatk" / "app"
    java_dest.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(native / "FlutterSunmiBridge.java", java_dest / "FlutterSunmiBridge.java")
    activity = main / "kotlin" / "com" / "mwaldatk" / "app" / "MainActivity.kt"
    if not activity.is_file():
        raise SystemExit("Unexpected Flutter MainActivity template.")
    shutil.copyfile(native / "MainActivity.kt", activity)
    drawable = main / "res" / "drawable"
    drawable.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(native / "ic_moldatk_launcher.xml", drawable / "ic_moldatk_launcher.xml")
    shutil.copytree(android, DEST)
print("Generated Android platform. Debug ID: com.mwaldatk.app.dev.")
