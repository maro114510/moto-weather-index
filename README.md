# 🏍️ Moto Weather Index API

A TypeScript-based REST API service that calculates motorcycle touring comfort indices based on real-time weather data. This service helps motorcyclists determine the best conditions for safe and enjoyable rides by analyzing multiple meteorological factors.

## 🌟 Features

- **Real-time Weather Analysis**: Fetches weather data from WeatherAPI.com
- **Comprehensive Scoring System**: Evaluates 8 key meteorological factors
- **Motorcycle-Specific Logic**: Scoring algorithms tailored for motorcycle touring safety and comfort
- **Cloudflare Workers Deployment**: Fast, globally distributed API responses
- **Caching Layer**: Efficient KV-based caching for improved performance
- **Type-Safe**: Full TypeScript implementation with Zod validation
- **RESTful API**: Clean, versioned API endpoints

## 🧮 Calculation Formula

The Touring Comfort Index (0-100) is calculated using the following weighted formula:

```
Touring Index = weatherScore + temperatureScore + windScore + humidityScore +
                visibilityScore + precipitationScore + uvScore + airQualityScore
```

### Factor Breakdown

| Factor | Max Points | Weight | Description |
|--------|------------|--------|-------------|
| **Weather Condition** | 30 | 30% | Primary weather state (clear, cloudy, rain, snow) |
| **Temperature** | 20 | 20% | Air temperature comfort for riding |
| **Wind Speed** | 15 | 15% | Wind conditions affecting stability |
| **Humidity** | 10 | 10% | Relative humidity comfort level |
| **Precipitation Probability** | 10 | 10% | Chance of rain/snow |
| **Visibility** | 5 | 5% | Visual range for safe riding |
| **UV Index** | 5 | 5% | Sun exposure risk |
| **Air Quality** | 5 | 5% | Pollution/allergen levels |

### Detailed Scoring Logic

#### Weather Condition Score (0-30 points)

```typescript
clear: 30 points     // Perfect riding weather
cloudy: 10 points    // Acceptable but less enjoyable
rain: 0 points       // Unsafe for motorcycles
snow: 0 points       // Dangerous conditions
unknown: 0 points    // Uncertain conditions
```

#### Temperature Score (0-20 points)

```typescript
idealTemp = 21.5°C
score = 20 - (|temperature - idealTemp| * 2)
score = Math.max(0, Math.min(20, Math.round(score)))

// Examples:
// 21.5°C = 20 points (ideal)
// 16.5°C or 26.5°C = 10 points (±5°C from ideal)
// <11.5°C or >31.5°C = 0 points (too extreme)
```

#### Wind Speed Score (0-15 points)

```typescript
if (windSpeed >= 1 && windSpeed <= 4) return 15;  // Ideal breeze
if (windSpeed === 0 || (windSpeed > 4 && windSpeed <= 7)) return 10;  // Still manageable
if (windSpeed > 7) return 0;  // Too dangerous
```

#### Humidity Score (0-10 points)

```typescript
idealHumidity = 50%
score = 10 - (|humidity - 50| / 5)
score = Math.max(0, Math.min(10, Math.round(score)))

// Examples:
// 50% = 10 points (ideal)
// 40% or 60% = 8 points
// 25% or 75% = 5 points
```

#### Visibility Score (0-5 points)

```typescript
if (visibility >= 15) return 5;  // Excellent visibility
if (visibility >= 10) return 4;  // Good visibility
if (visibility >= 6) return 2;   // Moderate visibility
return 0;  // Poor visibility (<6km)
```

#### Precipitation Probability Score (0-10 points)

```typescript
score = 10 - (precipitationProbability / 10)
score = Math.max(0, Math.min(10, Math.round(score)))

// Examples:
// 0% = 10 points
// 30% = 7 points
// 100% = 0 points
```

#### UV Index Score (0-5 points)

```typescript
if (uvIndex <= 4) return 5;  // Safe UV levels
if (uvIndex <= 6) return 3;  // Moderate risk
return 0;  // High UV risk (>6)
```

#### Air Quality Score (0-5 points)

```typescript
low: 5 points      // Clean air
medium: 3 points   // Moderate pollution
high: 0 points     // Poor air quality
undefined: 5 points // Assume best case
```

## 🚀 API Endpoints

### Base URL

- **Production**: `https://moto-weather-index.stelzen.dev`
- **Local**: `http://localhost:3000`

### Interactive Documentation

- **Swagger UI**: `/doc` - Interactive API documentation
- **OpenAPI Spec**: `/specification` - OpenAPI 3.0 specification

### Endpoints

#### GET `/health`

Health check endpoint.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2025-06-01T12:00:00.000Z"
}
```

#### GET `/api/v1/weather`

Get raw weather data for a location.

**Parameters:**

- `lat` (required): Latitude (-90 to 90)
- `lon` (required): Longitude (-180 to 180)
- `datetime` (optional): ISO 8601 datetime string (defaults to current time)

**Response:**

```json
{
  "datetime": "2025-06-01T12:00:00Z",
  "condition": "clear",
  "temperature": 21.5,
  "windSpeed": 2.5,
  "humidity": 50,
  "visibility": 20,
  "precipitationProbability": 0,
  "uvIndex": 3,
  "airQuality": "low"
}
```

#### GET `/api/v1/touring-index`

Calculate touring comfort index for a location.

**Parameters:**

- `lat` (required): Latitude (-90 to 90)
- `lon` (required): Longitude (-180 to 180)
- `datetime` (optional): ISO 8601 datetime string (defaults to current time)

**Response:**

```json
{
  "location": {
    "lat": 35.6785,
    "lon": 139.6823
  },
  "datetime": "2025-06-01T12:00:00Z",
  "score": 100,
  "factors": {
    "weather": 30,
    "temperature": 20,
    "wind": 15,
    "humidity": 10,
    "visibility": 5,
    "precipitationProbability": 10,
    "uvIndex": 5,
    "airQuality": 5
  }
}
```

#### GET `/api/v1/touring-index/history`

Get historical touring index data for a location.

**Parameters:**

- `lat` (required): Latitude (-90 to 90)
- `lon` (required): Longitude (-180 to 180)
- `startDate` (optional): Start date in YYYY-MM-DD format (defaults to 7 days ago)
- `endDate` (optional): End date in YYYY-MM-DD format (defaults to today)
- `prefectureId` (optional): Prefecture ID (1-47, auto-detected from coordinates if not provided)

**Response:**

```json
{
  "location": {
    "lat": 35.6762,
    "lon": 139.6503
  },
  "prefecture_id": 13,
  "data": [
    {
      "date": "2025-06-01",
      "score": 85.5,
      "factors": {
        "temperature": 20,
        "weather": 25,
        "wind": 15,
        "humidity": 10,
        "visibility": 5,
        "precipitationProbability": 10,
        "uvIndex": 5,
        "airQuality": 5
      },
      "calculated_at": "2025-06-01T06:00:00Z"
    }
  ]
}
```

**Features:**

- **Auto Prefecture Detection**: Automatically finds the nearest Japanese prefecture to given coordinates
- **Flexible Date Range**: Supports custom date ranges with validation (max 30 days, up to 16 days in future)
- **Historical Data**: Returns calculated touring indices from the database
- **Factor Breakdown**: Includes detailed scoring factors for each date

#### POST `/api/v1/touring-index/batch`

**🔐 Authentication Required**

Execute batch calculation for all Japanese prefectures for multiple days. This endpoint requires HMAC-SHA256 authentication.

**Authentication Headers:**

- `X-Touring-Auth`: HMAC-SHA256 signature
- `X-Timestamp`: Current timestamp (ISO 8601)

**Parameters:**

- `days` (optional): Number of days to calculate (1-30, default: 7)
- `maxRetries` (optional): Maximum retry attempts (1-10, default: 3)

**Response:**

```json
{
  "status": "completed",
  "duration_ms": 15432,
  "target_dates": ["2025-06-01", "2025-06-02", "2025-06-03"],
  "summary": {
    "total_processed": 141,
    "successful_inserts": 138,
    "failed_inserts": 3,
    "success_rate": 98
  },
  "errors": [
    "Prefecture 01 (2025-06-01): Weather data unavailable"
  ]
}
```

**Authentication Example:**

```bash
# Calculate HMAC signature
timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
signature=$(echo -n "$timestamp" | openssl dgst -sha256 -hmac "$BATCH_SECRET" -binary | base64)

# Make authenticated request
curl -X POST "https://moto-weather-index.stelzen.dev/api/v1/touring-index/batch?days=7" \
  -H "X-Touring-Auth: $signature" \
  -H "X-Timestamp: $timestamp"
```

## 🛠️ Tech Stack

### Core Technologies

- **Runtime**: [Bun](https://bun.sh/) - Fast JavaScript runtime and package manager
- **Framework**: [Hono](https://hono.dev/) - Lightweight web framework for Cloudflare Workers
- **Language**: TypeScript with strict type checking
- **Validation**: [Zod](https://zod.dev/) - Schema validation and type safety

### API & Documentation

- **OpenAPI**: [@hono/zod-openapi](https://github.com/honojs/middleware/tree/main/packages/zod-openapi) - Type-safe OpenAPI 3.0 integration
- **Documentation**: [Swagger UI](https://swagger.io/tools/swagger-ui/) - Interactive API documentation
- **HTTP Client**: [Axios](https://axios-http.com/) - Promise-based HTTP client

### Infrastructure & Deployment

- **Platform**: [Cloudflare Workers](https://workers.cloudflare.com/) - Serverless edge computing
- **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/) - SQLite-based serverless database
- **Cache**: [Cloudflare KV](https://developers.cloudflare.com/kv/) - Global key-value storage
- **Deployment**: [Wrangler](https://developers.cloudflare.com/workers/wrangler/) - Cloudflare Workers CLI

### External APIs

- **Weather Data**: [WeatherAPI.com](https://www.weatherapi.com/) - Weather forecast API (requires `WEATHERAPI_KEY`)
- **Prefecture Data**: Static Japanese prefecture coordinates

### Development Tools

- **Linting**: [Biome](https://biomejs.dev/) - Fast formatter and linter
- **Testing**: [Bun Test](https://bun.sh/docs/cli/test) - Built-in test runner
- **Task Runner**: [Task](https://taskfile.dev/) - Modern task runner
- **CI/CD**: GitHub Actions with automated deployment

### Monitoring & Logging

- **Structured Logging**: Custom logging utilities with different log levels
- **Error Handling**: Comprehensive middleware for error tracking and response
- **Request Tracking**: Unique request IDs and performance monitoring
- **Authentication**: HMAC-SHA256 signature-based authentication for batch operations

## 🌐 Deployment

### Cloudflare Workers

The API is deployed on Cloudflare Workers with the following configuration:

#### Automatic Scheduled Tasks

- **Cron Schedule**: Daily at 04:00 JST (19:00 UTC)
- **Operation**: Batch calculation for all Japanese prefectures (next 7 days)
- **Retry Logic**: Up to 3 attempts per failed operation

#### Environment Configuration

```toml
# wrangler.toml
name = 'moto-weather-index'
main = 'src/worker.ts'
compatibility_date = '2025-05-08'

[vars]
LOG_LEVEL = "INFO"

[triggers]
crons = ["0 19 * * *"]  # Daily at JST 4:00

[[kv_namespaces]]
binding = "OPEN_METEO_CACHE"

[[d1_databases]]
binding = "DB"
database_name = "moto-weather-db"
```

#### Rate Limiting Policy

To reduce operational risk and avoid unnecessary KV pressure, this application
does **not** enforce API rate limiting with Cloudflare KV in Worker code.

Recommended controls:

- Primary: [Cloudflare WAF Rate Limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/) at the edge
- Optional: [Workers Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) for endpoint-specific limits when needed

This keeps throttling close to Cloudflare's edge controls and avoids per-request
KV read/write amplification in the app layer.

#### Required Environment Variables

- `BATCH_SECRET`: HMAC secret for batch endpoint authentication
- `LOG_LEVEL`: Logging level (DEBUG, INFO, WARN, ERROR)
- `WEATHERAPI_KEY`: API key for WeatherAPI.com (required for weather fetching and tests)

### Local Development

1. **Clone and setup**

   ```bash
   git clone https://github.com/maro114510/moto-weather-index.git
   cd moto-weather-index
   bun install
   ```

2. **Start development server**

   ```bash
   bun run dev
   # or using Task
   task dev
   ```

3. **Access local API**

   - API: `http://localhost:3000`
   - Swagger UI: `http://localhost:3000/doc`
   - Health check: `http://localhost:3000/health`

### Deployment Commands

```bash
# Login to Cloudflare
task wrangler:login

# Deploy to production
task wrangler:deploy

# Start local Workers development
task wrangler:dev
```

### Testing & Quality Assurance

```bash
# Run all tests
WEATHERAPI_KEY=your_key bun test

# Lint code
task lint

# Format code
task format

# Fix lint issues
task lint:fix
```
