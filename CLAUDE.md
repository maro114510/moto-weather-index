# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Testing
```bash
# Run all tests
bun test

# Run specific test file
bun test src/utils/dateUtils.test.ts
bun test src/usecase/BatchCalculateTouringIndex.test.ts

# Test with watch mode during development
bun test --watch
```

### Development Servers
```bash
# Local development server with hot reload
task dev
# or directly: bun --hot src/index.ts

# Cloudflare Workers development server
task wrangler:dev
```

### Code Quality (Always run these after changes)
```bash
# Fix formatting and lint issues automatically
task lint:fix

# Check linting without fixing
task lint

# Format code
task format

# Verify all tests pass
task test
```

### Deployment
```bash
# Login to Cloudflare
task wrangler:login

# Deploy to production
task wrangler:deploy
```

## Architecture Overview

### Clean Architecture Implementation
This codebase follows Clean Architecture with clear separation:

- **Domain Layer** (`src/domain/`): Business logic and domain models (Weather, TouringScore, ScoreRules)
- **UseCase Layer** (`src/usecase/`): Application logic (CalculateTouringIndex, BatchCalculateTouringIndex)  
- **Interface Layer** (`src/interface/`): API handlers, routing, OpenAPI specs
- **Infrastructure Layer** (`src/infra/`): External service adapters (D1Database, OpenMeteoAPI)
- **DI Container** (`src/di/`): Dependency injection setup

### Batch Processing System
The core feature is automated touring index calculation:

- **Schedule**: Runs daily at JST 4:00 (UTC 19:00) via Cloudflare Cron
- **Scope**: All 47 Japanese prefectures × configurable number of days
- **Start Date Priority**: Query parameter > Environment variable (`BATCH_START_DATE`) > Default (today)
- **Validation**: Start date must be within last 7 days or up to 16 days in future
- **Retry Logic**: Up to 3 automatic retries with exponential backoff
- **API Endpoint**: `POST /api/v1/touring-index/batch` (requires HMAC-SHA256 auth)

### Authentication System
Batch operations require HMAC-SHA256 authentication:
- Headers: `X-Touring-Auth` (signature), `X-Timestamp` (ISO 8601)
- Secret: Environment variable `BATCH_SECRET`

### Rate Limiting System (Feature 002-kv)
Token bucket rate limiting protects API endpoints from abuse:
- **Per-IP Limit**: 10 requests per minute (burst capacity: 10 tokens)
- **Global Limit**: 100 requests per minute system-wide
- **Client ID**: IP address from `CF-Connecting-IP` header
- **Storage**: Cloudflare KV (`RATE_LIMIT_KV` binding) with 5-minute TTL
- **Error Response**: HTTP 429 with `Retry-After` header
- **Failure Mode**: Fail-open (allow requests when KV unavailable)
- **Middleware**: Applied globally before authentication, after logging

### Data Flow Architecture
1. **Weather Data**: Open-Meteo API → Repository → UseCase
2. **Batch Processing**: Fetch weather for date ranges → Calculate indices → Store in D1
3. **Caching**: 3-hour KV cache for weather API responses
4. **Database**: Cloudflare D1 (SQLite) with `touring_index` and `prefectures` tables

### Type Safety Implementation
- **Zod Schemas**: All API inputs/outputs validated with Zod schemas in `src/dao/`
- **OpenAPI Integration**: `@hono/zod-openapi` auto-generates API docs from schemas
- **Domain Types**: Strong typing for Weather, TouringScore, and other domain concepts

### Touring Index Calculation Logic
8-factor weighted scoring system (total 100 points):
- Weather Condition: 30 points (clear=30, cloudy=10, rain/snow=0)
- Temperature: 20 points (optimal at 21.5°C, decreases with distance)
- Wind Speed: 15 points (ideal 1-4 m/s, dangerous >7 m/s)
- Humidity: 10 points (optimal at 50%)
- Precipitation Probability: 10 points (linear decrease)
- Visibility: 5 points (excellent >15km, poor <6km)
- UV Index: 5 points (safe ≤4, dangerous >6)
- Air Quality: 5 points (low=5, medium=3, high=0)

## Critical Implementation Details

### Date Validation and Generation
- `validateBatchStartDate()`: Enforces 7-day lookback limit for batch operations
- `generateTargetDatesFromStart()`: Creates date arrays from custom start dates
- `validateDateRange()`: General date range validation (max 30 days, future limit 16 days)

### Error Handling Patterns
- **Zod Validation Errors**: Automatically formatted to user-friendly messages
- **Async Operations**: Proper Promise handling with typed error responses
- **External API Failures**: Retry logic with exponential backoff
- **Database Errors**: Graceful degradation with detailed logging

### Environment Configuration
- **Cloudflare Workers**: `wrangler.toml` defines cron, D1, KV bindings (including `RATE_LIMIT_KV`)
- **Environment Variables**: `LOG_LEVEL`, `BATCH_SECRET`, `BATCH_START_DATE` (optional)
- **Dual Runtime**: `src/index.ts` for local Node.js/Bun, `src/worker.ts` for Cloudflare Workers

### Logging and Monitoring
- **Structured Logging**: JSON format with request IDs, operation types, performance metrics
- **Log Levels**: DEBUG, INFO, WARN, ERROR controlled by `LOG_LEVEL`
- **Business Logic Tracking**: Dedicated logging for batch operations and API calls

## Development Workflow Requirements

After any code changes, always run:
1. `task lint:fix` - Auto-fix formatting and linting issues
2. `task test` - Verify all tests pass

These commands ensure code quality and prevent deployment issues.