#!/bin/bash
# Sync ShellGlance extension to GNOME Shell extensions directory

EXTENSION_UUID="shellglance@dnlvgl.com"
SOURCE_DIR="$(dirname "$(readlink -f "$0")")"
TARGET_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_UUID"

# Create target directory if it doesn't exist
mkdir -p "$TARGET_DIR"

# Sync files (excluding dev files)
rsync -av --delete \
    --exclude='.git' \
    --exclude='sync.sh' \
    --exclude='.gitignore' \
    "$SOURCE_DIR/" "$TARGET_DIR/"

echo ""
echo "Synced to: $TARGET_DIR"
echo ""
echo "Next steps:"
echo "  - Wayland: Log out and log back in"
echo "  - Enable:  gnome-extensions enable $EXTENSION_UUID"
