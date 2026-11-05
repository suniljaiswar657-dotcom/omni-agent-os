# OMNI Agent OS

**Independent multi-agent AI orchestration platform with a mobile-first command center.**

## Current status

This repository contains the first frontend foundation for OMNI Agent OS.

- Responsive command-center dashboard
- Master Orchestrator, Research Agent and Developer Agent cards
- Local mission creation and task status workflow
- Approval-state UI
- Local activity log and browser storage
- Light/dark visual toggle

### Important: current implementation is a local simulation

The dashboard does **not** currently connect to a real AI model, external agent runtime, cloud database, or third-party automation. Mission status transitions are simulated in the browser. Do not enter sensitive information.

## Run locally

No build step is required for this first static frontend.

1. Download or clone this repository.
2. Open `index.html` in a browser.

For deployment, import this repository into Vercel and use the default static-site settings (no build command; output directory can be left empty or set to the repository root).

## Roadmap

1. Establish a real backend API and persistent task database.
2. Add secure server-side model-provider integration (API keys must never be exposed in frontend code).
3. Implement agent handoff, retry handling, task history and structured run logs.
4. Add approval gates for external actions.
5. Add automated tests and deployment verification.

## Safety principles

- Human approval before external side effects.
- No automatic spending, posting, deletion, or irreversible actions.
- Treat model output and incoming task content as untrusted.
- Keep secrets in server-side environment variables only.

## Project

OMNI AGENT OS · Build 0.1.0 · Free-first foundation
