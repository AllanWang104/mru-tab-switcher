"""Install a macOS app with Homebrew when it isn't there yet."""
import shutil
import subprocess
import sys


def ensure_app_installed(app_path, cask, name, download_url):
    if app_path.exists():
        return
    if shutil.which("brew") is None:
        sys.exit(f"{name} isn't installed and Homebrew isn't available. "
                 f"Install it from {download_url}, then re-run.")
    print(f"Installing {name} with Homebrew...")
    subprocess.run(["brew", "install", "--cask", cask], check=True)
    subprocess.run(["open", "-a", name], check=True)
    print(f"Approve the permissions {name} asks for, or the remap won't work.")
