# Codebase Structure

## Root Directory
```
/
├── db/                     # Database schemas and migrations
├── src/                    # Source code (Clean Architecture)
├── .biomerc.json          # Biome linter/formatter config
├── Taskfile.yaml          # Task runner commands
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── wrangler.toml          # Cloudflare Workers config
├── CLAUDE.md              # Claude Code instructions
└── README.md              # Project documentation
```

## Source Code Structure (`src/`)

### Clean Architecture Layers

#### Domain Layer (`src/domain/`)
- `Weather.ts` - Weather domain model and types
- `TouringScore.ts` - Touring score calculation logic
- `ScoreRules.ts` - Scoring rules and algorithms
- Pure business logic, no external dependencies

#### UseCase Layer (`src/usecase/`)
- `CalculateTouringIndex.ts` - Single location calculation
- `BatchCalculateTouringIndex.ts` - Batch processing for prefectures
- Application orchestration logic

#### Interface Layer (`src/interface/`)
- `handlers/` - HTTP request handlers
  - `healthHandler.ts` - Health check endpoint
  - `weatherHandler.ts` - Weather data endpoints
  - `touringIndexHandler.ts` - Touring index endpoints
  - `prefectureHandler.ts` - Prefecture-related endpoints
  - `scheduledHandler.ts` - Cron job handler
- `middleware/` - HTTP middleware
  - `auth.ts` - HMAC authentication
  - `cors.ts` - CORS handling
  - `errorHandling.ts` - Error response formatting
  - `logging.ts` - Request logging
- `routes/` - Route definitions
  - `openapi.ts` - OpenAPI/Swagger configuration
- `router.ts` - Main router setup

#### Infrastructure Layer (`src/infra/`)
- `WeatherRepository.ts` - Weather data repository interface
- `OpenMeteoWeatherRepository.ts` - Open-Meteo API implementation
- `D1TouringIndexRepository.ts` - Cloudflare D1 database implementation

#### Shared Components

##### Data Access Objects (`src/dao/`)
- `weatherSchemas.ts` - Weather API schemas
- `touringIndexSchemas.ts` - Touring index schemas
- `prefectureSchemas.ts` - Prefecture schemas
- Zod validation schemas for all API inputs/outputs

##### Utilities (`src/utils/`)
- `dateUtils.ts` - Date manipulation and validation
- `logger.ts` - Structured logging utilities
- `prefectureUtils.ts` - Prefecture data and coordinates

##### Configuration (`src/config/`, `src/constants/`)
- `appConfig.ts` - Application configuration
- `httpStatus.ts` - HTTP status codes

##### Types (`src/types/`)
- `bun.d.ts` - Bun-specific type definitions

##### Dependency Injection (`src/di/`)
- `container.ts` - DI container setup and bindings

### Entry Points
- `src/index.ts` - Local Node.js/Bun development server
- `src/worker.ts` - Cloudflare Workers runtime entry point

## Test Files
- Co-located with source files using `.test.ts` suffix
- Examples: `dateUtils.test.ts`, `BatchCalculateTouringIndex.test.ts`
- Run with `bun test`

## Configuration Files
- `.biomerc.json` - Linting and formatting rules
- `tsconfig.json` - TypeScript compiler options
- `wrangler.toml` - Cloudflare Workers deployment config
- `Taskfile.yaml` - Development task definitions