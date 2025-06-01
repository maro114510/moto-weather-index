# 🏍️ Moto Weather Index API

A TypeScript-based REST API service that calculates motorcycle touring comfort indices based on real-time weather data. This service helps motorcyclists determine the best conditions for safe and enjoyable rides by analyzing multiple meteorological factors.

## 🌟 Features

- **Real-time Weather Analysis**: Fetches current weather data from Open-Meteo API
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

*Coming soon* - Historical touring index data

#### POST `/api/v1/touring-index/batch`

*Coming soon* - Batch calculation for multiple locations

## 🔧 Tech Stack

- **Runtime**: Bun.js
- **Framework**: Hono (lightweight web framework)
- **Language**: TypeScript
- **Validation**: Zod
- **Weather API**: Open-Meteo
- **Deployment**: Cloudflare Workers
- **Cache**: Cloudflare KV Store
- **Testing**: Bun test
- **Linting**: Biome

## 🏗️ Architecture

```bash
src/
├── domain/              # Business logic and core models
│   ├── Weather.ts       # Weather data types and validation
│   ├── ScoreRules.ts    # Scoring calculation functions
│   └── TouringScore.ts  # Score aggregation logic
├── usecase/             # Application use cases
│   └── CalculateTouringIndex.ts
├── infra/               # External service integrations
│   ├── WeatherRepository.ts
│   └── OpenMeteoWeatherRepository.ts
├── interface/           # HTTP interface layer
│   ├── router.ts        # Route definitions
│   └── handlers/        # Request handlers
├── di/                  # Dependency injection
└── types/               # Type definitions
```

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (latest version)
- [Cloudflare account](https://cloudflare.com/) (for deployment)

### Local Development

1. **Clone the repository**

   ```bash
   git clone https://github.com/maro114510/moto-weather-index.git
   cd moto-weather-index
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Start development server**

   ```bash
   bun run dev
   # or using Task
   task dev
   ```

4. **Test the API**

   ```bash
   curl "http://localhost:3000/api/v1/touring-index?lat=35.6785&lon=139.6823"
   ```

### Testing

```bash
# Run all tests
bun test

# Run with Task
task test
```

### Linting and Formatting

```bash
# Check code quality
task lint

# Format code
task format
```

## 🌐 Deployment

### Cloudflare Workers

1. **Login to Cloudflare**

   ```bash
   task wrangler:login
   ```

2. **Deploy**

   ```bash
   task wrangler:deploy
   ```

### Environment Variables

Configure in `wrangler.toml`:

```toml
[vars]
# Add any environment variables here

[[kv_namespaces]]
binding = "OPEN_METEO_CACHE"
id = "your-kv-namespace-id"
```

## 📊 Data Validation

All input data is validated using Zod schemas with the following constraints:

- **Temperature**: -50°C to 60°C
- **Wind Speed**: 0 to 50 m/s
- **Humidity**: 0% to 100%
- **Visibility**: 0 to 100 km
- **Precipitation Probability**: 0% to 100%
- **UV Index**: 0 to 20
- **Weather Condition**: clear, cloudy, rain, snow, unknown
- **Air Quality**: low, medium, high

## 🧪 Example Usage

### Perfect Touring Conditions

```bash
curl "https://moto-weather-index.stelzen.dev/api/v1/touring-index?lat=35.6785&lon=139.6823"
```

Response for ideal conditions:

```json
{
  "location": { "lat": 35.6785, "lon": 139.6823 },
  "datetime": "2025-06-01T12:00:00Z",
  "score": 100,
  "factors": {
    "weather": 30,        // Clear skies
    "temperature": 20,    // 21.5°C (ideal)
    "wind": 15,          // 2.5 m/s (gentle breeze)
    "humidity": 10,      // 50% (comfortable)
    "visibility": 5,     // 20km (excellent)
    "precipitationProbability": 10,  // 0% (no rain)
    "uvIndex": 5,        // 3 (safe)
    "airQuality": 5      // Low pollution
  }
}
```

### Poor Touring Conditions

Response for bad weather:

```json
{
  "score": 0,
  "factors": {
    "weather": 0,        // Snow/rain
    "temperature": 0,    // Too cold/hot
    "wind": 0,          // Too windy
    "humidity": 0,      // Too humid/dry
    "visibility": 0,    // Poor visibility
    "precipitationProbability": 0,  // High chance of rain
    "uvIndex": 0,       // Dangerous UV
    "airQuality": 0     // Poor air quality
  }
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run `task lint` and `task test`
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [Open-Meteo](https://open-meteo.com/) for providing free weather API
- [Cloudflare Workers](https://workers.cloudflare.com/) for serverless hosting
- Motorcycle touring community for inspiration and requirements

## 📞 Support

For issues and questions:

- Open an issue on GitHub
- Check existing documentation
- Review the test files for usage examples
