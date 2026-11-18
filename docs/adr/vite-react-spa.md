# Build the interface with Vite and React, and serve it with Hono

## Context

The frontend uses Next.js with the App Router on Cloudflare Workers through OpenNext. The build is heavy, the deploy workflow was disabled and its scripts no longer exist, and the App Router adds routing and rendering layers the product does not use. The interface is client-driven: location consent, queries, charts, and settings all run in the browser. Server rendering only prefetches the first score.

## Decision

The interface is a React single-page application built with Vite. The server is a Hono application that serves the interface's assets and the endpoints under /api. Both run in one Cloudflare Worker.

## Rationale

Server rendering earns its cost when search traffic or per-page metadata matters; neither is a goal here. Vite and Hono are small, direct tools, and the existing Hono code already holds the server logic worth keeping. Staying on Next.js keeps the weight and the fragile pipeline. React Router 7 and Astro keep a rendering layer the product does not need. SvelteKit discards the React components and their tests.

## Consequences

- The product loses server rendering, per-page metadata, and link previews.
- The interface is rebuilt on the new structure; the existing components inform the design but are not reused as they are.
- One build and one deployment replace two.
- The Worker serves static assets and falls back to the interface entry for client routes.
