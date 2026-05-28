#!/usr/bin/env bash
set -euo pipefail

FLUTTER_VERSION="${FLUTTER_VERSION:-3.24.5}"
FLUTTER_CHANNEL="${FLUTTER_CHANNEL:-stable}"
FLUTTER_HOME="$HOME/flutter"
SDK_TARBALL="flutter_linux_${FLUTTER_VERSION}-${FLUTTER_CHANNEL}.tar.xz"

if [ ! -x "$FLUTTER_HOME/bin/flutter" ]; then
  echo "==> Downloading Flutter ${FLUTTER_VERSION} (${FLUTTER_CHANNEL})"
  curl --fail --silent --show-error --location \
    -o /tmp/flutter.tar.xz \
    "https://storage.googleapis.com/flutter_infra_release/releases/${FLUTTER_CHANNEL}/linux/${SDK_TARBALL}"
  echo "==> Extracting Flutter"
  tar -xf /tmp/flutter.tar.xz -C "$HOME"
  rm -f /tmp/flutter.tar.xz
fi

export PATH="$FLUTTER_HOME/bin:$PATH"

# Vercel build images run as root. Git refuses to operate on dirs whose
# owner uid differs from the current user, which makes Flutter unable to
# read its own SDK revision (reports 0.0.0-unknown) and pub get fails.
# Trust everything in CI.
git config --global --add safe.directory '*'

flutter --version
flutter config --no-analytics --no-cli-animations >/dev/null

echo "==> flutter pub get"
flutter pub get

echo "==> flutter build web"
flutter build web --release --pwa-strategy=offline-first

echo "==> Build complete: build/web"
ls -la build/web | head
