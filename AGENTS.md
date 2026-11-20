# AGENTS

This file defines the minimum working rules for coding agents in this repository.

## Scope
- This is the single source of truth for agent behavior in this repo.

## Workflow
- Make focused, minimal changes that solve the requested task.
- Do not restate architecture or code behavior that is already clear from source.
- Prefer existing patterns in `src/domain`, `src/usecase`, `src/infra`, `src/interface`, and `src/client`.

## Validation
- Run `task lint`, `task typecheck`, `task build`, and `task test` after changes.
- Tests need no external credentials, because the application keeps no provider key.

## Safety
- Never commit or log secrets.
- Avoid destructive Git operations unless explicitly requested.

## Completion
- A task is done only when `task lint`, `task typecheck`, `task build`, and `task test` pass locally.
