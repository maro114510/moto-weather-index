# Obtain forecasts and air quality from Open-Meteo

## Context

The index depends on eight weather factors. The current provider requires an API key, charges beyond a free tier, and stopped returning air quality, which made every index request fail. The product is a personal, non-commercial application.

## Decision

The product obtains forecasts and air quality from Open-Meteo and keeps no provider credential.

## Rationale

Open-Meteo returns sixteen days of hourly forecast and supplies air quality from a companion endpoint. Its free service needs no key, which removes a secret and the risk of its abuse. The existing place search already uses Open-Meteo's geocoding. Keeping WeatherAPI retains the key, the cost, and the air-quality failure. Abstracting the provider to support both adds a layer with no second consumer.

## Consequences

- The product accepts Open-Meteo's non-commercial terms and credits Open-Meteo with the CC-BY attribution.
- The weather mapping and the scoring inputs are rewritten against Open-Meteo's response shape and WMO codes.
- Commercial use requires a paid plan or another provider.
- The free service allows ten thousand calls per day, so caching and edge protection guard the quota.
