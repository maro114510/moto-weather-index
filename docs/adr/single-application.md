# Serve the product as a single application with no public API

## Context

The product is split into a public REST API and a separate frontend. The API publishes scoring and history endpoints under an OpenAPI contract, and the frontend calls it over the public network. The frontend is the only consumer. The split costs two deployments, a generated client, CORS configuration, and a contract kept in step across two repositories.

## Decision

The product is delivered as one application that serves the interface and the endpoints the interface calls. The public REST API is retired. The frontend repository is archived, and its code moves into the product repository.

## Rationale

A published contract pays off only when something other than the product consumes it. Nothing does. Removing the split also removes the network hop, CORS, the generated client, and the drift between two deployments. Keeping the split, sharing the contract instead of publishing it, and treating the API as a product of its own each keep the operating cost of a consumer that does not exist. Re-publishing an interface later remains possible without a separate deployment.

## Consequences

- External consumers of the API lose access. None are known.
- The API contract, its documentation, and its CORS configuration disappear.
- One repository and one deployment replace two.
- A future external consumer requires a new decision and a new interface.
