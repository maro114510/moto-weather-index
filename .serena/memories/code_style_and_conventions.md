# Code Style and Conventions

## Code Style Configuration
- **Formatter**: Biome
- **Linter**: Biome with recommended rules
- **Configuration File**: `.biomerc.json`

## Formatting Rules
- **Indent Style**: Spaces (2 spaces)
- **Indent Width**: 2
- **Line Endings**: Auto-detected

## Linting Rules
- **Base**: Recommended rules enabled
- **Explicit Any**: Disabled (noExplicitAny: off)
- **Unused Variables**: Warning level
- **No Var**: Warning level (prefer const/let)
- **ForEach**: Disabled (noForEach: off)

## TypeScript Configuration
- **Target**: ES2022
- **Module**: ESNext
- **Module Resolution**: bundler
- **Strict Mode**: Enabled
- **Types**: Cloudflare Workers, Node, Bun, Jest

## File Structure Conventions
- **Domain Layer**: `src/domain/` - Business logic, domain models
- **UseCase Layer**: `src/usecase/` - Application logic
- **Interface Layer**: `src/interface/` - API handlers, routes, middleware
- **Infrastructure Layer**: `src/infra/` - External service adapters
- **Shared**: `src/utils/`, `src/constants/`, `src/types/`, `src/dao/`

## Naming Conventions
- **Files**: camelCase for TypeScript files
- **Classes**: PascalCase
- **Functions**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **Interfaces/Types**: PascalCase
- **Test Files**: `*.test.ts` suffix

## Schema and Validation
- **Validation Library**: Zod
- **Schema Naming**: `*Schema` suffix
- **API Schemas**: Located in `src/dao/`
- **Domain Types**: Located in `src/domain/`

## Clean Architecture Patterns
- **Dependency Direction**: Always inward (Interface → UseCase → Domain)
- **Repository Pattern**: Abstract repositories in domain, concrete in infra
- **Dependency Injection**: Container-based DI in `src/di/`
- **Error Handling**: Domain-specific errors with proper HTTP mapping