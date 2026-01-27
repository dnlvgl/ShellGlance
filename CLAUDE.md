# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ShellGlance is a GNOME Shell 49 extension that displays terminal command outputs in the top bar. It uses ESM module format required by GNOME Shell 49.

## Development Commands

```bash
make install   # First-time install to ~/.local/share/gnome-shell/extensions/
make update    # Update installed extension and open Extensions app for reload
make enable    # Enable extension
make disable   # Disable extension
make prefs     # Open preferences
make logs      # Follow GNOME Shell logs
make zip       # Create distributable zip
```

## Development Workflow

On Wayland, GNOME Shell must be restarted to load extension changes. Use `make update` to copy changes and open the Extensions app - disable/enable the extension there to reload. Changes to `prefs.js` can be tested by closing and reopening the preferences window.

## Architecture

### extension.js - Main Extension

Three main classes:

- **CommandRunner**: Static class for async command execution using `Gio.Subprocess` with timeout support
- **CommandManager**: Manages command list, per-command timers (`GLib.timeout_add_seconds`), and result caching. Listens to GSettings changes and restarts timers accordingly
- **ShellGlanceIndicator** (extends `PanelMenu.Button`): Top bar widget with label and dropdown menu. Updates display when CommandManager notifies of result changes

### prefs.js - Preferences Dialog

Uses libadwaita (Adw) widgets:

- **CommandRow** (extends `Adw.ExpanderRow`): Editable row for a single command with name, command, interval, timeout, enabled fields
- **ShellGlancePreferences** (extends `ExtensionPreferences`): Main preferences window with command list and general settings

### Settings Storage

Commands are stored as a JSON string in GSettings (schema: `org.gnome.shell.extensions.shellglance`). Each command object has: `id`, `name`, `command`, `interval`, `timeout`, `enabled`.

### Key GNOME Shell Imports

```javascript
// Core libraries
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';

// UI libraries
import St from 'gi://St';           // Shell toolkit (labels, boxes, icons)
import Clutter from 'gi://Clutter'; // Animation/layout

// Shell UI modules
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

// Extension base class
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
```

## Extension UUID

`shellglance@dnlvgl.com`
