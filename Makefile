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

# ComfyUI runs one job at a time, so nothing here may run in parallel, whatever -j says.
.NOTPARALLEL:

.PHONY: help build typecheck test sweep play check goal-check clean deps \
	assets base styled frames cutouts music sfx processed sheet comfy-up comfy-down comfy-status clean-assets settle

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

dist/game.js: $(SRC) scripts/build.ts tsconfig.json assets/manifest.json assets/fallbacks.json node_modules/.installed
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

# ---- assets -------------------------------------------------------------
# Every generated file is a target. The per-asset rules come from the manifest.

make/assets.mk: assets/manifest.json assets/prompts.json assets/fallbacks.json scripts/gen-rules.ts scripts/lib/manifest.ts scripts/lib/comfy-api.ts node_modules/.installed
	$(NODE) scripts/gen-rules.ts

-include make/assets.mk

base: $(ASSETS_BASE) ## Generate base images (Flux 2 and Z-Image)
styled: $(ASSETS_STYLED) ## Generate style-matched images (Krea-2, from the reference sprite)
frames: $(ASSETS_FRAMES) ## Generate animation frames (Qwen edit)
cutouts: $(ASSETS_CUTOUTS) ## Remove backgrounds (BiRefNet)
music: $(ASSETS_MUSIC) ## Generate music (ACE-Step)
sfx: $(ASSETS_SFX) ## Generate sound effects (Stable Audio)
processed: $(ASSETS_PROCESSED) ## Post-process raw files into assets/ (no ComfyUI needed)

# Prerequisites are built left to right and never in parallel, so jobs run one workflow at a time:
# base images, style-matched images, frames, cutouts, music, sound effects, then post-processing.
assets: $(ASSETS_BASE) $(ASSETS_STYLED) $(ASSETS_FRAMES) $(ASSETS_CUTOUTS) $(ASSETS_MUSIC) $(ASSETS_SFX) $(ASSETS_PROCESSED) ## Generate and post-process everything in the manifest; skips what exists

SHEET_INPUTS := $(filter %.png,$(ASSETS_PROCESSED)) $(wildcard raw/images/*.json raw/frames/*.json)
out/sheets/.built: $(SHEET_INPUTS) scripts/sheet.ts
	$(NODE) scripts/sheet.ts
	@touch $@

sheet: out/sheets/.built ## Build contact sheets of every image in out/sheets/

report: node_modules/.installed ## Rewrite docs/asset-review.md and docs/final-report.md from the generation records
	$(NODE) scripts/report.ts

comfy-up: ## Start ComfyUI if it is not already running
	$(NODE) scripts/comfy.ts up

comfy-down: ## Stop ComfyUI, but only the instance this build started
	$(NODE) scripts/comfy.ts down

comfy-status: ## Say whether ComfyUI is running and who started it
	$(NODE) scripts/comfy.ts status

settle: ## After a fresh clone: mark raw files, cutouts, and assets up to date, in that order, without running jobs
	@touch -c make/entries/*.json make/assets.mk; sleep 1
	@touch -c $(ASSETS_BASE) $(ASSETS_MUSIC) $(ASSETS_SFX); sleep 1
	@touch -c $(ASSETS_STYLED) $(ASSETS_FRAMES); sleep 1
	@touch -c $(ASSETS_CUTOUTS); sleep 1
	@touch -c $(ASSETS_PROCESSED)
	@echo "settle: timestamps put in dependency order"

# ---- cleaning -----------------------------------------------------------

clean: ## Remove build output (dist/ and the stamps in out/); never touches assets or raw/
	rm -rf dist out/.typecheck

clean-assets: ## Remove processed assets only; raw/ and its records are never deleted
	rm -rf assets/images assets/frames assets/music assets/sfx out/sheets
