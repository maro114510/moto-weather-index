# Moto Weather Index

Moto Weather Index tells a rider how comfortable a motorcycle ride will be at a chosen place and time in Japan. It turns the forecast for that place into a Touring Index from 0 to 100, shows the factors behind the index, and extends the same judgement across the coming week.

It is one application: a Cloudflare Worker serves the interface as static assets and the few internal endpoints the interface calls. It publishes no API for other systems, has no accounts, and keeps no history. Every index is computed from a forecast fetched for the request.

## Touring Index

The index is the sum of eight factors, each with a maximum contribution.

| Factor | Max points |
|--------|-----------:|
| Weather condition | 30 |
| Temperature | 20 |
| Wind speed | 15 |
| Humidity | 10 |
| Precipitation probability | 10 |
| Visibility | 5 |
| UV index | 5 |
| Air quality | 5 |

A missing factor never suppresses the index. The application scores the factors it has, names the missing ones, and reports a lower confidence. See the [design document](docs/design/moto-weather-index.md) for the domain model and the scenarios, and the [decision records](docs/adr) for the reasons behind the design.

## Weather data

Forecasts, air quality, and place search come from [Open-Meteo](https://open-meteo.com/), which needs no API key.

Weather data by [Open-Meteo.com](https://open-meteo.com/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Open-Meteo's free service is for non-commercial use, so commercial use requires a paid plan or another provider.

## Stack

- [Vite](https://vite.dev/) and [React](https://react.dev/) for the client-rendered interface
- [Hono](https://hono.dev/) on [Cloudflare Workers](https://workers.cloudflare.com/) for the internal endpoints and static asset delivery
- [Zod](https://zod.dev/) for validation, [Biome](https://biomejs.dev/) for linting, and [Bun](https://bun.sh/) for packages and tests

## Development

Install [Bun](https://bun.sh/) and [Task](https://taskfile.dev/), then run:

```bash
bun install
task dev        # start the development server
task lint       # Biome
task typecheck  # the Worker and the interface
task build      # the interface and the Worker
task test       # unit and component tests
```

`task ci:post-check` runs the same checks as the CI unit job. The end-to-end scenarios run with `bun run test:e2e`, which the CI end-to-end job also runs.

## Deployment

The default branch builds a deployable artifact in GitHub Actions. Deploy with `bunx wrangler deploy`, which builds the interface first. No provider credential is required.

## License

[MIT](LICENSE)
