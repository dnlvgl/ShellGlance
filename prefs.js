import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';


function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
}


/**
 * CommandRow - An expandable row for editing a single command
 */
class CommandRow extends Adw.ExpanderRow {
    static {
        GObject.registerClass(this);
    }

    constructor(command, onUpdate, onDelete) {
        super({
            title: command.name || 'Unnamed Command',
            subtitle: command.command || 'No command set',
        });

        this._command = {...command};
        this._onUpdate = onUpdate;
        this._onDelete = onDelete;

        this._buildUI();
    }

    _addEntry(title, key, fallback, onExtra) {
        const row = new Adw.EntryRow({title, text: this._command[key] || ''});
        row.connect('changed', () => {
            this._command[key] = row.text;
            onExtra?.(row.text);
            this._onUpdate(this._command);
        });
        this.add_row(row);
    }

    _addSpin(title, subtitle, key, lower, upper, fallback) {
        const row = new Adw.SpinRow({
            title, subtitle,
            adjustment: new Gtk.Adjustment({
                lower, upper, step_increment: 1, page_increment: 10,
                value: this._command[key] ?? fallback,
            }),
        });
        row.connect('notify::value', () => {
            this._command[key] = row.value;
            this._onUpdate(this._command);
        });
        this.add_row(row);
    }

    _buildUI() {
        this._addEntry('Name', 'name', '', text => {
            this.title = text || 'Unnamed Command';
        });
        this._addEntry('Command', 'command', '', text => {
            this.subtitle = text || 'No command set';
        });
        this._addSpin('Refresh Interval', 'Seconds between refreshes', 'interval', 1, 3600, 5);
        this._addSpin('Timeout', 'Maximum seconds to wait for command', 'timeout', 1, 300, 10);

        const enabledRow = new Adw.SwitchRow({
            title: 'Enabled',
            subtitle: 'Show this command in the top bar',
            active: this._command.enabled ?? true,
        });
        enabledRow.connect('notify::active', () => {
            this._command.enabled = enabledRow.active;
            this._onUpdate(this._command);
        });
        this.add_row(enabledRow);

        const deleteRow = new Adw.ActionRow({title: 'Delete Command'});
        const deleteButton = new Gtk.Button({
            label: 'Delete',
            css_classes: ['destructive-action'],
            valign: Gtk.Align.CENTER,
        });
        deleteButton.connect('clicked', () => this._onDelete(this._command.id));
        deleteRow.add_suffix(deleteButton);
        deleteRow.activatable_widget = deleteButton;
        this.add_row(deleteRow);
    }

    getCommand() {
        return this._command;
    }
}


/**
 * Main preferences window
 */
export default class ShellGlancePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        this._settings = this.getSettings();
        this._commands = this._loadCommands();
        this._commandRows = new Map();

        // Create main page
        const page = new Adw.PreferencesPage({
            title: 'ShellGlance',
            icon_name: 'utilities-terminal-symbolic',
        });
        window.add(page);

        // Commands group
        this._commandsGroup = new Adw.PreferencesGroup({
            title: 'Commands',
            description: 'Configure commands to display in the top bar',
        });
        page.add(this._commandsGroup);

        // Add existing commands
        for (const command of this._commands) {
            this._addCommandRow(command);
        }

        // Add command button
        const addButton = new Gtk.Button({
            label: 'Add Command',
            css_classes: ['suggested-action'],
            margin_top: 12,
        });
        addButton.connect('clicked', () => this._addNewCommand());
        this._commandsGroup.add(addButton);

        // General settings group
        const generalGroup = new Adw.PreferencesGroup({
            title: 'General Settings',
            description: 'Configure display options',
        });
        page.add(generalGroup);

        // Separator entry
        const separatorRow = new Adw.EntryRow({
            title: 'Separator',
            text: this._settings.get_string('separator'),
        });
        separatorRow.connect('changed', () => this._settings.set_string('separator', separatorRow.text));
        generalGroup.add(separatorRow);

        // Max length spin row
        const maxLengthRow = new Adw.SpinRow({
            title: 'Maximum Display Length',
            subtitle: 'Characters per command in top bar',
            adjustment: new Gtk.Adjustment({
                lower: 5,
                upper: 200,
                step_increment: 5,
                page_increment: 10,
                value: this._settings.get_int('max-length'),
            }),
        });
        maxLengthRow.connect('notify::value', () => this._settings.set_int('max-length', maxLengthRow.value));
        generalGroup.add(maxLengthRow);
    }

    _loadCommands() {
        try {
            const json = this._settings.get_string('commands');
            return JSON.parse(json);
        } catch (e) {
            console.error('ShellGlance: Failed to parse commands:', e);
            return [];
        }
    }

    _saveCommands() {
        const json = JSON.stringify(this._commands);
        this._settings.set_string('commands', json);
    }

    _addCommandRow(command) {
        const row = new CommandRow(
            command,
            cmd => this._onCommandUpdate(cmd),
            id => this._onCommandDelete(id)
        );
        this._commandRows.set(command.id, row);
        this._commandsGroup.add(row);
    }

    _addNewCommand() {
        const newCommand = {
            id: generateId(),
            name: 'New Command',
            command: 'echo "Hello, World!"',
            interval: 5,
            timeout: 10,
            enabled: true,
        };

        this._commands.push(newCommand);
        this._saveCommands();
        this._addCommandRow(newCommand);
    }

    _onCommandUpdate(updatedCommand) {
        const index = this._commands.findIndex(cmd => cmd.id === updatedCommand.id);
        if (index !== -1) {
            this._commands[index] = updatedCommand;
            this._saveCommands();
        }
    }

    _onCommandDelete(commandId) {
        const index = this._commands.findIndex(cmd => cmd.id === commandId);
        if (index !== -1) {
            this._commands.splice(index, 1);
            this._saveCommands();

            const row = this._commandRows.get(commandId);
            if (row) {
                this._commandsGroup.remove(row);
                this._commandRows.delete(commandId);
            }
        }
    }
}
