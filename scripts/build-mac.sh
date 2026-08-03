#!/usr/bin/env bash
# Build, sign, notarize, and upload the macOS .dmg to S3.
#
# Required env vars (for signing + notarization):
#   APPLE_API_ISSUER         (App Store Connect API issuer ID)
#   APPLE_API_KEY            (App Store Connect API key ID)
#   APPLE_API_KEY_PATH       (absolute path to the AuthKey_*.p8 file)
#   APPLE_SIGNING_IDENTITY   (e.g. "Developer ID Application: Your Co (TEAMID)")
#
# Optional:
#   S3_BUCKET                (default: the-platypus-app)
#   S3_REGION                (default: us-east-1)
#   AWS_PROFILE              (default: none; uses your default AWS credentials)
#
# Usage:
#   ./scripts/build-mac.sh           # build + upload
#   ./scripts/build-mac.sh --no-upload    # build only (skip S3)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# ── Auto-load credentials from .env.build if present (gitignored) ──
# `set -a` auto-exports every variable defined while sourcing, so subprocesses
# (npm, tauri-bundler, codesign, notarytool) inherit them even if .env.build
# uses bare `KEY=value` lines without `export`.
if [[ -f "$ROOT_DIR/.env.build" ]]; then
  echo "==> Loading credentials from .env.build"
  set -a
  # shellcheck disable=SC1090
  source "$ROOT_DIR/.env.build"
  set +a
fi

# ── Require signing env vars ──
: "${APPLE_API_ISSUER:?APPLE_API_ISSUER must be set}"
: "${APPLE_API_KEY:?APPLE_API_KEY must be set}"
: "${APPLE_API_KEY_PATH:?APPLE_API_KEY_PATH must be set}"
: "${APPLE_SIGNING_IDENTITY:?APPLE_SIGNING_IDENTITY must be set}"

if [[ ! -f "$APPLE_API_KEY_PATH" ]]; then
  echo "❌ APPLE_API_KEY_PATH does not exist: $APPLE_API_KEY_PATH"
  exit 1
fi

S3_BUCKET="${S3_BUCKET:-the-platypus-app}"
S3_REGION="${S3_REGION:-us-east-1}"
SKIP_UPLOAD=0
for arg in "$@"; do
  [[ "$arg" == "--no-upload" ]] && SKIP_UPLOAD=1
done

# ── Verify AWS CLI is available (unless skipping upload) ──
if [[ "$SKIP_UPLOAD" -eq 0 ]]; then
  if ! command -v aws >/dev/null 2>&1; then
    echo "❌ aws CLI not found. Install with: brew install awscli"
    exit 1
  fi
fi

# ── Bundle artifact cleanup ──
# Tauri's bundle_dmg.sh calls `hdiutil convert ... -o <path>` WITHOUT -ov, so any
# leftover .dmg at the target path aborts the build with no clear error. The script
# also leaves `rw.<name>.dmg` read-write templates and a mounted /Volumes/Platypus
# behind whenever it dies mid-bundle.
#
# The stale mount matters twice over: a second copy mounts as "Platypus 1" while the
# bundler's AppleScript still addresses disk "Platypus", and bundle_dmg.sh's own
# leftover-unmount logic detaches the FIRST mounted disk image on the system, which
# may be an unrelated volume.
clean_bundle_artifacts() {
  rm -f src-tauri/target/release/bundle/dmg/*.dmg \
        src-tauri/target/release/bundle/dmg/rw.*.dmg \
        src-tauri/target/release/bundle/macos/*.dmg \
        src-tauri/target/release/bundle/macos/rw.*.dmg \
        src-tauri/target/release/bundle/macos/.DS_Store 2>/dev/null || true

  for vol in /Volumes/Platypus*; do
    if [[ -d "$vol" ]]; then
      echo "    detaching stale mount: $vol"
      hdiutil detach "$vol" -force >/dev/null 2>&1 || true
    fi
  done
}

# ── Build (with retries on DMG bundling failures) ──
# bundle_dmg.sh fails intermittently in the window between mounting the temp image
# and detaching it: the Finder-prettifying AppleScript can time out or be blocked by
# Automation permissions, and `hdiutil detach` gives up after 3 tries when Spotlight
# is still holding the fresh volume. Both surface as the same opaque message,
# "error running bundle_dmg.sh". Neither has anything to do with the project's code,
# so a cleanup + retry usually succeeds. Compiled Rust artifacts are cached, so a
# retry mostly redoes the bundling step.
#
# Retries are gated on that specific message: a genuine compile or signing failure
# fails once and exits, rather than burning three attempts.
MAX_ATTEMPTS=3
BUILD_LOG="$(mktemp -t platypus-build)"
trap 'rm -f "$BUILD_LOG"' EXIT

attempt=1
while true; do
  echo "==> Pre-build cleanup (stale DMGs, rw templates, leftover mounts)..."
  clean_bundle_artifacts

  # The final attempt sets CI=true, which makes the bundler pass --skip-jenkins to
  # bundle_dmg.sh so it skips the Finder AppleScript entirely. That drops the custom
  # icon layout but removes the flakiest step, so the build still produces a DMG.
  if [[ "$attempt" -lt "$MAX_ATTEMPTS" ]]; then
    echo "==> Building Tauri macOS app (signed + notarized) [attempt $attempt/$MAX_ATTEMPTS]..."
    BUILD_ENV=""
  else
    echo "==> Building [attempt $attempt/$MAX_ATTEMPTS — skipping Finder layout AppleScript]..."
    BUILD_ENV="CI=true"
  fi

  # Run tauri build directly (skips the tauri:build npm script which references a missing plist fix).
  # BUILD_ENV is unquoted on purpose: it is either empty or one literal KEY=value with
  # no spaces, and an empty array would break under `set -u` on macOS's bash 3.2.
  # shellcheck disable=SC2086
  if env $BUILD_ENV npx tauri build 2>&1 | tee "$BUILD_LOG"; then
    [[ "$attempt" -eq "$MAX_ATTEMPTS" ]] && \
      echo "⚠️  Built with the plain DMG layout (custom icon positions skipped)."
    break
  fi

  if ! grep -q "bundle_dmg.sh" "$BUILD_LOG"; then
    echo "❌ Build failed for a reason unrelated to DMG bundling — not retrying (see output above)."
    exit 1
  fi

  if [[ "$attempt" -ge "$MAX_ATTEMPTS" ]]; then
    echo "❌ DMG bundling failed after $MAX_ATTEMPTS attempts."
    echo "   Check System Settings → Privacy & Security → Automation and make sure this"
    echo "   terminal is allowed to control Finder, then try again."
    exit 1
  fi

  echo "⚠️  DMG bundling failed (attempt $attempt) — cleaning up and retrying..."
  attempt=$((attempt + 1))
  sleep 5
done

# ── Locate the DMG ──
DMG_PATH=$(find src-tauri/target/release/bundle/dmg -maxdepth 1 -name "*.dmg" | head -1)
if [[ -z "$DMG_PATH" ]]; then
  echo "❌ No .dmg produced under src-tauri/target/release/bundle/dmg"
  exit 1
fi

DMG_FILE=$(basename "$DMG_PATH")
DMG_SIZE=$(du -h "$DMG_PATH" | cut -f1)
echo "==> Built: $DMG_PATH ($DMG_SIZE)"

# Verify signature + notarization ticket
echo "==> Verifying signature..."
codesign --verify --deep --strict --verbose=2 "$DMG_PATH" 2>&1 | tail -3 || true

if [[ "$SKIP_UPLOAD" -eq 1 ]]; then
  echo "==> Skipping S3 upload (--no-upload)"
  exit 0
fi

# ── Upload to S3 ──
echo "==> Uploading to s3://$S3_BUCKET/$DMG_FILE"
aws s3 cp "$DMG_PATH" "s3://$S3_BUCKET/$DMG_FILE" \
  --region "$S3_REGION" \
  --content-type application/x-apple-diskimage

# Mirror to a stable "latest" URL for the website's download button
LATEST_KEY="PlatypusNotes-latest.dmg"
echo "==> Mirroring to s3://$S3_BUCKET/$LATEST_KEY"
aws s3 cp "$DMG_PATH" "s3://$S3_BUCKET/$LATEST_KEY" \
  --region "$S3_REGION" \
  --content-type application/x-apple-diskimage

echo
echo "✅ Done"
echo "   Versioned: https://$S3_BUCKET.s3.$S3_REGION.amazonaws.com/$DMG_FILE"
echo "   Latest:    https://$S3_BUCKET.s3.$S3_REGION.amazonaws.com/$LATEST_KEY"
