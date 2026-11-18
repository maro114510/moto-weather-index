# Compute every index on request and keep no history

## Context

The system stores daily scores in D1 and fills them with a daily scheduled batch over fourteen days. The batch has never committed a row: the upstream data is incomplete, and the run-log table was never applied to the production database. The stored scores describe prefecture centroids, while the interface asks for the rider's coordinates. The provider returns a multi-day forecast in one request.

## Decision

The product stores no scores and runs no schedule. Every index is computed from a forecast fetched for the request. D1, the cron trigger, the batch calculation, the history endpoint, and the readiness endpoint are removed.

## Rationale

The stored data serves a week view that one forecast request produces. Persistence adds a schema, migrations, a scheduler, and a failure mode the product does not need. The stored scores were never read successfully and describe a different place from the one the rider selects. Keeping the precomputation or accumulating past results keeps a database and a schedule for data the rider never sees. Restoring history later is a separate project, not a lost capability.

## Consequences

- The week view becomes a forecast view; no past day is available.
- No database, migration path, or scheduled job remains to operate.
- Availability depends on the provider at request time; caching and the degraded index carry it.
- Reintroducing history requires a new decision and a migration path.
