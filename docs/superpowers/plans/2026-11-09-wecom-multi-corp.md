# Multi-corporation WeCom Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task. User approved the design and implementation; execute inline without another approval gate.

**Goal:** Three WeCom enterprises log into one FastGPT and supply a complete merged directory.
**Architecture:** A single wecom provider, browser-bound login transactions and local one-use codes, cached complete directory snapshots.
**Tech Stack:** Bun, TypeScript, Express, native fetch and node:crypto.
**Spec:** ../specs/2026-11-09-wecom-multi-corp-design.md

## Global Constraints

- Keep standalone Bun scripts and Bearer authentication on both sync endpoints.
- No real credentials, automatic account merging, partial sync success or multi-instance deployment.
- Implement only WeCom; preserve FastGPT response fields and stable identity mapping.
- Work in current checkout on codex/wecom-multi-corp; preserve existing untracked files. No push or automatic commit.

## Review Focus

- Duplicate query values and unapproved redirect URLs must fail.
- Callback replay, wrong-browser state and expired local codes must fail.
- Identical user/department IDs in different enterprises must remain distinct.
- Missing ancestors and duplicate memberships must produce valid organization references.
- One enterprise API failure must prevent partial success; upstream secrets must never reach responses.

### Task 1: Configuration and WeCom client

Files: src/wecom/config.ts, src/wecom/client.ts, tests/wecom.test.ts, package.json.
Interfaces: loadConfig(): Config; WeComClient.get(corp, path, params, directory?): Promise<Record<string, unknown>>.
- [x] Write and run failing configuration/identity tests for three companies, unique keys, exact callback allowlist and scoped identity IDs.
- [x] Implement configuration validation, bounded expiring stores, identity mapping, timed API requests, per-corporation token caches and one retry for expired tokens.
- [x] Run tests and type checking.

### Task 2: Aggregate directory

Files: src/wecom/directory.ts, tests/wecom.test.ts.
Interfaces: Directory.get(): Promise<{ userList: UserListType; orgList: OrgListType }>.
- [x] Write and run failing tests for three-subject aggregation, deduplication, missing parent attachment and whole-snapshot failure.
- [x] Read department/list and user/list with the configured app credentials, enumerate visible departments, validate results and atomically cache complete snapshots for 60 seconds.
- [x] Verify failure, empty or malformed responses, cyclic hierarchy and unknown memberships.

### Task 3: Login and HTTP endpoints

Files: src/wecom/login.ts, src/provider/index.ts, src/controllers.ts, src/app.ts, src/index.ts, src/middleware.ts, src/type.ts.
Interfaces: createApp(config, client?): Express app; login.start(), selection handlers, callback(), consumeCode().
- [x] Write failing actual HTTP integration tests with a local mock WeCom server.
- [x] Implement select-company HTML, browser cookie binding, random state, callback identity exchange, allowlisted return URLs and local one-use codes.
- [x] Register only wecom, remove obsolete SAML/example providers and routes. Fail startup on invalid provider settings.
- [x] Verify success and failure paths, auth boundaries and provider fallback through HTTP.

### Task 4: Deployment, docs and final verification

Files: README.md, .env.template, Dockerfile, .gitignore, bun.lock, tests/.
- [x] Document all three corporation configurations, self-built application permissions, visible range, trusted domains/IP, public callback and FastGPT connection.
- [x] Align Docker with Bun and remove unused dependencies.
- [x] Run build, typecheck, complete tests and git diff --check; obtain a fresh whole-change review and fix material findings.
- [x] Report local verification separately from real credential-dependent WeCom/FastGPT integration.

## Execution ledger

- Setup: feature branch created; Bun absent from PATH; obtaining a temporary pinned Bun runtime for verification.
- Ruling: current FastGPT documentation specifies root parentId as an empty string, unlike this template's old '0' example. Use an empty parentId for enterprise roots for FastGPT compatibility; keep three separate enterprise roots.

- Task 1: complete — configuration, case-insensitive namespaced identities, bounded expiring store and cached timed API client tested.
- Task 2: complete — atomic complete directory snapshots, hierarchy validation, membership deduplication and all-enterprise failure tested.
- Task 3: complete — actual HTTP tests cover all three login routes, callback replay, code consumption, redirects and Bearer boundaries. Source and built startup smoke passed; unknown provider settings rejected at startup.
- Task 4: complete — README, env template, Bun Docker recipe and frozen lockfile updated. 16 tests / 125 assertions pass; typecheck, build and diff whitespace checks pass.
- Final review: fixed failed-refresh overlap — regression reproduced peak concurrency 8 before fix, then passed after Promise.allSettled retained pending until all reads finished. Full suite 16/16 green.
- Validation limits: no Docker executable available; no real enterprise credentials or target FastGPT instance supplied, so Docker build and live enterprise/FastGPT integration remain deployment checks.
- Ruling: preserve original checkout and feature branch with uncommitted changes; no automatic merge, push or commit. Existing .idea/ and package-lock.json left untouched.
