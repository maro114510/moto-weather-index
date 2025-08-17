# Moto Weather Index API - Project Overview

## Purpose
A TypeScript-based REST API service that calculates motorcycle touring comfort indices based on real-time weather data. The service helps motorcyclists determine the best conditions for safe and enjoyable rides by analyzing multiple meteorological factors.

## Key Features
- Real-time weather analysis using Open-Meteo API
- Comprehensive 8-factor scoring system (weather, temperature, wind, humidity, visibility, precipitation, UV, air quality)
- Motorcycle-specific scoring algorithms tailored for touring safety and comfort
- Cloudflare Workers deployment for global distribution
- KV-based caching for performance
- Automated batch processing for all Japanese prefectures
- HMAC-SHA256 authenticated batch operations
- Clean Architecture implementation with clear layer separation

## Tech Stack
- **Runtime**: Bun (JavaScript runtime and package manager)
- **Framework**: Hono (lightweight web framework for Cloudflare Workers)
- **Language**: TypeScript with strict type checking
- **Validation**: Zod for schema validation and type safety
- **API Documentation**: OpenAPI 3.0 with Swagger UI via @hono/zod-openapi
- **Database**: Cloudflare D1 (SQLite-based serverless database)
- **Cache**: Cloudflare KV storage
- **External APIs**: Open-Meteo API for weather data
- **Deployment**: Cloudflare Workers with Wrangler CLI
- **Linting/Formatting**: Biome
- **Testing**: Bun Test
- **Task Runner**: Task (Taskfile.yaml)

## Architecture
Follows Clean Architecture with clear separation:
- **Domain Layer** (`src/domain/`): Business logic (Weather, TouringScore, ScoreRules)
- **UseCase Layer** (`src/usecase/`): Application logic (CalculateTouringIndex, BatchCalculateTouringIndex)
- **Interface Layer** (`src/interface/`): API handlers, routing, OpenAPI specs
- **Infrastructure Layer** (`src/infra/`): External service adapters (D1Database, OpenMeteoAPI)
- **DI Container** (`src/di/`): Dependency injection setup