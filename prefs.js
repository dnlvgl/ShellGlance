import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';


/**
 * Generates a simple UUID for command identification
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
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

    _buildUI() {
        // Name entry
        const nameRow = new Adw.EntryRow({
            title: 'Name',
            text: this._command.name || '',
        });
        nameRow.connect('changed', () => {
            this._command.name = nameRow.text;
            this.title = nameRow.text || 'Unnamed Command';
            this._onUpdate(this._command);
        });
        this.add_row(nameRow);

        // Command entry
        const commandRow = new Adw.EntryRow({
            title: 'Command',
            text: this._command.command || '',
        });
        commandRow.connect('changed', () => {
            this._command.command = commandRow.text;
            this.subtitle = commandRow.text || 'No command set';
            this._onUpdate(this._command);
        });
        this.add_row(commandRow);

        // Interval spin row
        const intervalRow = new Adw.SpinRow({
            title: 'Refresh Interval',
            subtitle: 'Seconds between refreshes',
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 3600,
                step_increment: 1,
                page_increment: 10,
                value: this._command.interval ?? 5,
            }),
        });
        intervalRow.connect('notify::value', () => {
            this._command.interval = intervalRow.value;
            this._onUpdate(this._command);
        });
        this.add_row(intervalRow);

        // Timeout spin row
        const timeoutRow = new Adw.SpinRow({
            title: 'Timeout',
            subtitle: 'Maximum seconds to wait for command',
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 300,
                step_increment: 1,
                page_increment: 10,
                value: this._command.timeout ?? 10,
            }),
        });
        timeoutRow.connect('notify::value', () => {
            this._command.timeout = timeoutRow.value;
            this._onUpdate(this._command);
        });
        this.add_row(timeoutRow);

        // Enabled switch row
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

        // Delete button row
        const deleteRow = new Adw.ActionRow({
            title: 'Delete Command',
        });
        const deleteButton = new Gtk.Button({
            label: 'Delete',
            css_classes: ['destructive-action'],
            valign: Gtk.Align.CENTER,
        });
        deleteButton.connect('clicked', () => {
            this._onDelete(this._command.id);
        });
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
        addButton.connect('clicked', () => {
            this._addNewCommand();
        });
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
        separatorRow.connect('changed', () => {
            this._settings.set_string('separator', separatorRow.text);
        });
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
        maxLengthRow.connect('notify::value', () => {
            this._settings.set_int('max-length', maxLengthRow.value);
        });
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
            (updatedCommand) => this._onCommandUpdate(updatedCommand),
            (commandId) => this._onCommandDelete(commandId)
        );
        this._commandRows.set(command.id, row);
        this._commandsGroup.add(row);
    }

    _addNewCommand() {
        const newCommand = {
            id: generateUUID(),
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
