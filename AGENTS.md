# Repository Guidelines

## Project Structure & Module Organization
- `src/domain/`: Core types and rules (e.g., `Weather.ts`, `ScoreRules.ts`).
- `src/usecase/`: Application logic (e.g., `CalculateTouringIndex.ts`).
- `src/infra/`: External adapters (e.g., `WeatherApiWeatherRepository.ts`, `D1TouringIndexRepository.ts`).
- `src/interface/`: HTTP layer with handlers, routes, middleware.
- `src/dao/`: Zod schemas for request/response validation.
- `src/constants/`, `src/utils/`, `src/di/`: Config, helpers, and DI wiring.
- Tests are colocated as `*.test.ts` next to source files.

## Build, Test, and Development Commands
- `bun run dev`: Start local server (see README for ports).
- `WEATHERAPI_KEY=your_key bun test`: Run test suite (WeatherAPI required).
- `task lint` / `task format`: Lint and format via Biome.
- `task wrangler:dev` / `task wrangler:deploy`: Cloudflare Workers dev/deploy.

## Coding Style & Naming Conventions
- Language: TypeScript (ESNext), 2‑space indentation.
- Lint/Format: Biome (`task lint`, `task format`).
- Naming: PascalCase for classes/value objects; camelCase for variables/functions; `CONSTANT_CASE` for constants. File names follow the dominant pattern in each layer (e.g., `TouringScore.ts`, `weatherHandler.ts`).
- Validation: Use Zod schemas in `src/dao` and domain validators (e.g., `WeatherSchema`).

## Testing Guidelines
- Framework: Bun Test.
- Location: Colocated `*.test.ts` with concise, behavior‑focused cases.
- Running: `WEATHERAPI_KEY=your_key bun test`.
- Prefer unit tests for rules, and thin integration tests for infra adapters.

## Completion Criteria
- The task is complete when the following pass locally:
  - `task test` (set `WEATHERAPI_KEY` where required)
  - `task lint`

## Commit & Pull Request Guidelines
- Use clear, scoped messages. Preferred: Conventional Commits (`feat:`, `fix:`, `chore(deps):`, `refactor:`). Examples from history: `fix:`, `chore(deps): bump`, `fix(biome):`.
- PRs must include: purpose/summary, linked issues, testing notes (commands/output), and any API/infra changes. Add screenshots or curl outputs when changing HTTP endpoints.

## Security & Configuration Tips
- Secrets: Do not commit keys. Set `WEATHERAPI_KEY` locally/CI. Cloudflare KV binding `OPEN_METEO_CACHE` is used for caching.
- Errors/Logging: Use `logger` utilities; avoid leaking secrets in logs.
- Determinism: When adding tests touching external APIs, gate with env vars and keep responses normalized to the `Weather` domain type.
