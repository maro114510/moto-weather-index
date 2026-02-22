# AGENTS

This file defines the minimum working rules for coding agents in this repository.

## Scope
- This is the single source of truth for agent behavior in this repo.

## Workflow
- Make focused, minimal changes that solve the requested task.
- Do not restate architecture or code behavior that is already clear from source.
- Prefer existing patterns in `src/domain`, `src/usecase`, `src/infra`, and `src/interface`.

## Validation
- Run `task lint` after changes.
- Run `task test` after changes.
- If tests require external credentials, set `WEATHERAPI_KEY` before running.

## Safety
- Never commit or log secrets.
- Avoid destructive Git operations unless explicitly requested.

## Completion
- A task is done only when `task lint` and `task test` pass locally, or when blocked by missing required secrets and that blocker is reported.
