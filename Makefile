# The Eye Below: everything that produces files goes through here.
# Run "make help" for the list of targets.

SHELL := /bin/bash
.DEFAULT_GOAL := help
.DELETE_ON_ERROR:

NODE := node
SRC := $(shell find src -type f \( -name '*.ts' -o -name '*.css' \))
TESTS := $(wildcard tests/*.ts)
SCRIPTS := $(wildcard scripts/*.ts scripts/lib/*.ts)
SESSION ?= 1

.PHONY: help build typecheck test sweep play check goal-check clean deps

help: ## List the targets
	@echo "The Eye Below - make targets"
	@grep -E '^[a-z][a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | sed -E 's/^([a-zA-Z_-]+):.*## (.*)/  \1|\2/' | column -t -s '|'
	@echo "  dist/game.js  The bundle itself (rebuilt only when a source file changed)"

# ---- dependencies -------------------------------------------------------

node_modules/.installed: package.json package-lock.json
	npm ci --no-audit --no-fund
	@touch $@

deps: node_modules/.installed ## Install the npm packages (only when package.json changed)

# ---- build --------------------------------------------------------------

dist/game.js: $(SRC) scripts/build.ts tsconfig.json node_modules/.installed
	$(NODE) scripts/build.ts

build: dist/game.js ## Bundle the game into dist/game.js

out/.typecheck: $(SRC) $(TESTS) $(SCRIPTS) tsconfig.json node_modules/.installed
	@mkdir -p out
	node_modules/.bin/tsc -p .
	@touch $@

typecheck: out/.typecheck ## Check the TypeScript (only when a file changed)

# ---- tests and checks ---------------------------------------------------

test: node_modules/.installed ## Run the generator, determinism, and rules tests
	$(NODE) --test tests/

sweep: node_modules/.installed ## Generate thousands of levels and verify every one is solvable
	$(NODE) scripts/sweep.ts

play: dist/game.js ## Run the headless browser smoke script (screenshots in out/shots/smoke)
	$(NODE) scripts/play.ts --scenario smoke

check: typecheck test build play ## Typecheck, tests, build, and the browser smoke run. Run before every commit.
	@echo "check: all passed"

goal-check: ## Run every acceptance check for a session: make goal-check SESSION=1
	$(NODE) scripts/goal-check.ts $(SESSION)

# ---- cleaning -----------------------------------------------------------

clean: ## Remove build output (dist/ and the stamps in out/); never touches assets or raw/
	rm -rf dist out/.typecheck
