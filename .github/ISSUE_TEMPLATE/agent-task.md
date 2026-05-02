---
name: Agent Task
about: Scoped task for Codex or Claude
title: "[Agent] "
labels: ["agent-task"]
assignees: ""
---

## Goal

Describe the user-visible goal in one or two sentences.

## Background

Link or summarize the relevant docs, research, examples, or previous PRs.

## Preferred Agent

- [ ] Codex
- [ ] Claude
- [ ] Either
- [ ] Human decision needed

## Files Allowed

List files or directories the agent may edit.

- 

## Files Off Limits

List files or directories the agent must not edit in this task.

- `main` direct push
- 

## Scope

What should be done:

- 

## Out of Scope

What should not be done:

- New examples unless explicitly requested
- Large renames or deletes
- Dependency upgrades
- BLE behavior changes without real-device validation
- 

## Validation

Required checks:

- [ ] `git diff --check`
- [ ] `node scripts/check-examples-catalog.js` if catalog or example metadata changes
- [ ] `node --check <changed-js-file>` if JavaScript changes
- [ ] Local server `curl -I` or browser preview for changed pages
- [ ] Real-device Chrome validation if BLE behavior changes

## Acceptance Criteria

- [ ] The PR has one clear purpose.
- [ ] The change does not edit files outside the allowed scope.
- [ ] Public-facing text is clear and natural.
- [ ] Any example status change is justified.
- [ ] Real-device validation is honestly reported.

## Questions for Human

List decisions that should not be guessed.

- 

## Notes for Other Agents

Mention branch, related PRs, or possible conflicts.

- 
