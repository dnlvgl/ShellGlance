# ShellGlance

A GNOME Shell 49 extension that displays terminal command outputs in the top bar.

## Features

- **Multiple Commands**: Configure multiple shell commands with individual refresh intervals
- **Top Bar Display**: Combined output display with configurable separator (e.g., `CPU: 45% | RAM: 2.1G`)
- **Dropdown Menu**: Click to view full command outputs
- **Per-Command Settings**: Individual refresh intervals, timeouts, and enable/disable toggles
- **Error Handling**: Visual error indicator when commands fail
- **Configurable Timeout**: Default 10 seconds per command to prevent hanging

## Requirements

- GNOME Shell 49

## Installation

### Manual Installation

1. Clone or download this repository:
   ```bash
   git clone https://github.com/yourusername/ShellGlance.git
   cd ShellGlance
   ```

2. Copy to GNOME Shell extensions directory:
   ```bash
   cp -r . ~/.local/share/gnome-shell/extensions/shellglance@dnlvgl.com/
   ```
   
   or sync via script
   
   ```bash
   ./sync.sh
   ```

3. Restart GNOME Shell:
   - **Wayland**: Log out and log back in

4. Enable the extension:
   ```bash
   gnome-extensions enable shellglance@dnlvgl.com
   ```

## Configuration

Open the extension preferences via:
- GNOME Extensions app
- Running `gnome-extensions prefs shellglance@dnlvgl.com`
- Clicking "Settings" in the extension dropdown menu

### Command Settings

Each command has the following options:

| Setting | Description | Default |
|---------|-------------|---------|
| Name | Display name shown in top bar | - |
| Command | Shell command to execute | - |
| Refresh Interval | Seconds between refreshes | 5 |
| Timeout | Maximum seconds to wait | 10 |
| Enabled | Show in top bar | true |

### General Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Separator | String between command outputs | ` \| ` |
| Max Display Length | Characters per command in top bar | 30 |

## Example Commands

```bash
# CPU usage
top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1

# Memory usage
free -h | awk '/^Mem:/ {print $3}'

# Disk usage
df -h / | awk 'NR==2 {print $5}'

# Current time
date +%H:%M

# Network IP
hostname -I | awk '{print $1}'

# Battery percentage (laptops)
cat /sys/class/power_supply/BAT0/capacity
```

## File Structure

```
ShellGlance/
├── metadata.json          # Extension metadata
├── extension.js           # Main extension code
├── prefs.js              # Preferences dialog
├── stylesheet.css         # Custom styling
├── schemas/
│   ├── gschemas.compiled  # Compiled schema
│   └── org.gnome.shell.extensions.shellglance.gschema.xml
└── icons/
    └── error-symbolic.svg
```

## Troubleshooting

### View Extension Logs

```bash
journalctl -f -o cat /usr/bin/gnome-shell
```

### Recompile Schemas

If settings aren't working, try recompiling:

```bash
glib-compile-schemas ~/.local/share/gnome-shell/extensions/shellglance@dnlvgl.com/schemas/
```

### Extension Not Appearing

1. Verify the extension is in the correct directory
2. Check that the UUID matches the directory name
3. Restart GNOME Shell
4. Check logs for errors

## Development

### Testing in Nested Session

```bash
dbus-run-session -- gnome-shell --nested --wayland
```

### Building Schemas

```bash
glib-compile-schemas schemas/
```

## Resources

### Official Documentation

- [GNOME Shell Extensions Guide](https://gjs.guide/extensions/) - Comprehensive guide for extension development


## License
