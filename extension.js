import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';


/**
 * CommandRunner - Handles async command execution with timeout
 */
class CommandRunner {
    static _result(success, output = '', error = '') {
        return {success, output: output?.trim() ?? '', error: error?.trim() ?? ''};
    }

    /**
     * Run a shell command asynchronously with timeout
     * @param {string} command - The shell command to execute
     * @param {number} timeout - Timeout in seconds
     * @returns {Promise<{success: boolean, output: string, error: string}>}
     */
    static async run(command, timeout = 10) {
        return new Promise((resolve) => {
            let timeoutId = null;
            let cancellable = new Gio.Cancellable();

            try {
                const proc = Gio.Subprocess.new(
                    ['/bin/sh', '-c', command],
                    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
                );

                timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, timeout * 1000, () => {
                    cancellable.cancel();
                    proc.force_exit();
                    timeoutId = null;
                    resolve(CommandRunner._result(false, '', 'Command timed out'));
                    return GLib.SOURCE_REMOVE;
                });

                proc.communicate_utf8_async(null, cancellable, (subprocess, result) => {
                    if (timeoutId != null) {
                        GLib.source_remove(timeoutId);
                        timeoutId = null;
                    }

                    try {
                        const [, stdout, stderr] = subprocess.communicate_utf8_finish(result);
                        resolve(CommandRunner._result(subprocess.get_successful(), stdout, stderr));
                    } catch (e) {
                        resolve(CommandRunner._result(false, '', e.message));
                    }
                });
            } catch (e) {
                if (timeoutId != null)
                    GLib.source_remove(timeoutId);
                resolve(CommandRunner._result(false, '', e.message));
            }
        });
    }
}


/**
 * CommandManager - Manages multiple commands with individual timers
 */
class CommandManager {
    constructor(settings) {
        this._settings = settings;
        this._commands = [];
        this._timers = new Map();
        this._results = new Map();
        this._callbacks = [];
        this._settingsChangedId = null;

        this._loadCommands();
        this._connectSettings();
    }

    _connectSettings() {
        this._settingsChangedId = this._settings.connect('changed::commands', () => {
            this._loadCommands();
            this._restartAllTimers();
            this._notifyChange();
        });
    }

    _loadCommands() {
        try {
            const json = this._settings.get_string('commands');
            this._commands = JSON.parse(json);
        } catch (e) {
            console.error('ShellGlance: Failed to parse commands:', e);
            this._commands = [];
        }
    }

    getCommands() {
        return this._commands;
    }

    getEnabledCommands() {
        return this._commands.filter(cmd => cmd.enabled);
    }

    getResult(commandId) {
        return this._results.get(commandId) ?? {success: true, output: '', error: ''};
    }

    getAllResults() {
        const results = {};
        for (const cmd of this._commands) {
            results[cmd.id] = this.getResult(cmd.id);
        }
        return results;
    }

    onResultsChanged(callback) {
        this._callbacks.push(callback);
    }

    _notifyChange() {
        for (const callback of this._callbacks) {
            try {
                callback();
            } catch (e) {
                console.error('ShellGlance: Callback error:', e);
            }
        }
    }

    async _runCommand(command) {
        const result = await CommandRunner.run(command.command, command.timeout ?? 10);
        this._results.set(command.id, result);
        this._notifyChange();
    }

    _startTimer(command) {
        // Clear existing timer for this command
        this._stopTimer(command.id);

        if (!command.enabled) {
            return;
        }

        // Run immediately
        this._runCommand(command);

        // Set up recurring timer
        const interval = command.interval ?? 5;
        const timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, interval, () => {
            this._runCommand(command);
            return GLib.SOURCE_CONTINUE;
        });

        this._timers.set(command.id, timerId);
    }

    _stopTimer(commandId) {
        const timerId = this._timers.get(commandId);
        if (timerId != null) {
            GLib.source_remove(timerId);
            this._timers.delete(commandId);
        }
    }

    _restartAllTimers() {
        this.stopAll();
        this.startAll();
    }

    startAll() {
        for (const command of this._commands) {
            if (command.enabled)
                this._startTimer(command);
        }
    }

    stopAll() {
        for (const timerId of this._timers.values())
            GLib.source_remove(timerId);
        this._timers.clear();
    }

    async refreshAll() {
        const promises = this.getEnabledCommands().map(cmd => this._runCommand(cmd));
        await Promise.all(promises);
    }

    destroy() {
        if (this._settingsChangedId != null) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }
        this.stopAll();
        this._callbacks = [];
        this._results.clear();
    }
}


/**
 * ShellGlanceIndicator - Panel button with combined output display and dropdown menu
 */
class ShellGlanceIndicator extends PanelMenu.Button {
    static {
        GObject.registerClass(this);
    }

    constructor(extension) {
        super(0.0, 'ShellGlance', false);

        this._extension = extension;
        this._settings = extension.getSettings();
        this._commandManager = new CommandManager(this._settings);

        this._buildUI();
        this._connectSignals();
        this._commandManager.startAll();
    }

    _buildUI() {
        // Main box for the panel button
        this._box = new St.BoxLayout({
            style_class: 'panel-status-menu-box',
        });

        // Label showing combined outputs
        this._label = new St.Label({
            text: 'ShellGlance',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'shellglance-label',
        });

        // Error icon (hidden by default)
        this._errorIcon = new St.Icon({
            icon_name: 'dialog-error-symbolic',
            style_class: 'shellglance-error system-status-icon',
            visible: false,
        });

        this._box.add_child(this._errorIcon);
        this._box.add_child(this._label);
        this.add_child(this._box);

        // Build dropdown menu
        this._buildMenu();
    }

    _buildMenu() {
        // Command outputs section
        this._outputSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._outputSection);

        // Separator
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const refreshItem = new PopupMenu.PopupMenuItem('Refresh All');
        refreshItem.connect('activate', () => this._commandManager.refreshAll());
        this.menu.addMenuItem(refreshItem);

        const settingsItem = new PopupMenu.PopupMenuItem('Settings');
        settingsItem.connect('activate', () => this._extension.openPreferences());
        this.menu.addMenuItem(settingsItem);
    }

    _connectSignals() {
        this._commandManager.onResultsChanged(() => this._updateDisplay());
        this._settingsChangedId = this._settings.connect('changed', () => this._updateDisplay());
    }

    _updateDisplay() {
        const enabledCommands = this._commandManager.getEnabledCommands();
        const separator = this._settings.get_string('separator');
        const maxLength = this._settings.get_int('max-length');

        let hasError = false;
        const outputs = enabledCommands.map(cmd => {
            const result = this._commandManager.getResult(cmd.id);
            if (!result.success)
                hasError = true;

            const text = (result.success ? result.output : 'Error') || '...';
            const firstLine = text.split('\n')[0];
            const truncated = firstLine.length > maxLength
                ? firstLine.substring(0, maxLength - 1) + '\u2026'
                : firstLine;
            const prefix = cmd.name ? `${cmd.name}: ` : '';
            return `${prefix}${truncated}`;
        });

        this._label.text = outputs.length > 0 ? outputs.join(separator) : 'ShellGlance';
        this._errorIcon.visible = hasError;
        this._updateMenu();
    }

    _updateMenu() {
        this._outputSection.removeAll();

        const enabledCommands = this._commandManager.getEnabledCommands();

        if (enabledCommands.length === 0) {
            this._outputSection.addMenuItem(new PopupMenu.PopupMenuItem(
                'No commands configured', {reactive: false}));
            return;
        }

        for (const cmd of enabledCommands) {
            const result = this._commandManager.getResult(cmd.id);
            const cmdName = cmd.name || 'Unnamed';
            const outputText = (result.success ? result.output : `Error: ${result.error}`) || '(empty output)';

            const lines = outputText.split('\n');
            const display = lines.slice(0, 10);
            if (lines.length > 10)
                display.push(`... (${lines.length - 10} more lines)`);

            const [first, ...rest] = display;
            const fullText = rest.length > 0
                ? `${cmdName}: ${first}\n${rest.join('\n')}`
                : `${cmdName}: ${first}`;

            this._outputSection.addMenuItem(new PopupMenu.PopupMenuItem(fullText, {
                reactive: false,
                style_class: result.success ? 'shellglance-menu-output' : 'shellglance-menu-error',
            }));
            this._outputSection.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        }
    }

    destroy() {
        if (this._settingsChangedId != null) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }
        this._commandManager?.destroy();
        this._commandManager = null;
        super.destroy();
    }
}

/**
 * Main Extension class
 */
export default class ShellGlanceExtension extends Extension {
    enable() {
        this._indicator = new ShellGlanceIndicator(this);
        Main.panel.addToStatusArea(this.metadata.uuid, this._indicator);
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
