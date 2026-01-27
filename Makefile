# Makefile for ShellGlance GNOME Shell Extension

NAME     = shellglance
DOMAIN   = dnlvgl.com
UUID     = $(NAME)@$(DOMAIN)

INSTALL_DIR  = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
BUILD_DIR    = build

# Files to include in distribution
DIST_FILES = \
	extension.js \
	prefs.js \
	stylesheet.css \
	metadata.json \
	schemas/org.gnome.shell.extensions.$(NAME).gschema.xml \
	schemas/gschemas.compiled \
	icons/error-symbolic.svg \
	LICENSE

.PHONY: help
help:
	@echo "ShellGlance Makefile"
	@echo ""
	@echo "  make install  - First-time install"
	@echo "  make update   - Update installed extension and open Extensions app"
	@echo "  make enable   - Enable the extension"
	@echo "  make disable  - Disable the extension"
	@echo "  make prefs    - Open extension preferences"
	@echo "  make logs     - Follow GNOME Shell logs"
	@echo "  make zip      - Create distributable zip"
	@echo "  make clean    - Remove build artifacts"

.PHONY: schemas
schemas:
	glib-compile-schemas schemas/

# First-time install
.PHONY: install
install: schemas
	@if [ -d "$(INSTALL_DIR)" ]; then \
		echo "Already installed. Use 'make update' instead."; \
		exit 1; \
	fi
	@mkdir -p $(INSTALL_DIR)/schemas $(INSTALL_DIR)/icons
	cp extension.js prefs.js stylesheet.css metadata.json $(INSTALL_DIR)/
	cp schemas/*.xml schemas/gschemas.compiled $(INSTALL_DIR)/schemas/
	cp icons/*.svg $(INSTALL_DIR)/icons/
	@echo "Installed to $(INSTALL_DIR)"
	@echo "Run 'make enable' to enable the extension"

# Update existing install and open Extensions app for testing
.PHONY: update
update: schemas
	@if [ ! -d "$(INSTALL_DIR)" ]; then \
		echo "Not installed. Use 'make install' first."; \
		exit 1; \
	fi
	rm -rf $(INSTALL_DIR)/*
	@mkdir -p $(INSTALL_DIR)/schemas $(INSTALL_DIR)/icons
	cp extension.js prefs.js stylesheet.css metadata.json $(INSTALL_DIR)/
	cp schemas/*.xml schemas/gschemas.compiled $(INSTALL_DIR)/schemas/
	cp icons/*.svg $(INSTALL_DIR)/icons/
	@echo "Updated $(INSTALL_DIR)"
	@gnome-extensions disable $(UUID) 2>/dev/null || true
	@gnome-extensions enable $(UUID)
	@echo "Extension reloaded"

.PHONY: enable
enable:
	gnome-extensions enable $(UUID)

.PHONY: disable
disable:
	gnome-extensions disable $(UUID)

.PHONY: prefs
prefs:
	gnome-extensions prefs $(UUID)

.PHONY: logs
logs:
	journalctl -f -o cat /usr/bin/gnome-shell

.PHONY: zip
zip: schemas
	@mkdir -p $(BUILD_DIR)
	@rm -f $(BUILD_DIR)/$(UUID).zip
	@zip -r $(BUILD_DIR)/$(UUID).zip $(DIST_FILES)
	@echo "Created $(BUILD_DIR)/$(UUID).zip"

.PHONY: clean
clean:
	rm -rf $(BUILD_DIR)
	rm -f schemas/gschemas.compiled
