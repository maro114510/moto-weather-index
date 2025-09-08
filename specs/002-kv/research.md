# Research: KV Token Bucket Rate Limiting

## Research Findings

### Existing Middleware Architecture
**Decision**: Integrate rate limiting as a global middleware in the existing Hono architecture  
**Rationale**: 
- Current architecture uses `app.use("*", middleware)` for global middleware application
- Middleware chain: CORS → Logging → Error Handling → (Rate Limiting) → Authentication
- Clean separation of concerns with each middleware having specific responsibilities
**Alternatives considered**: 
- Per-route middleware: Rejected - would require manual application to each route
- External proxy: Rejected - adds complexity and doesn't leverage existing KV infrastructure

### KV Storage Integration
**Decision**: Use existing KV binding pattern with additional namespace for rate limiting  
**Rationale**:
- `wrangler.toml` already configures KV namespaces (OPEN_METEO_CACHE example)
- Cloudflare Workers environment provides KV bindings automatically
- Existing pattern: `c.env.KV_NAMESPACE.get/put` for storage operations
**Alternatives considered**:
- New external storage: Rejected - KV is optimized for this use case
- In-memory storage: Rejected - doesn't persist across worker restarts

### Token Bucket Algorithm for Distributed Systems
**Decision**: Simple token bucket with KV-based state persistence  
**Rationale**:
- Handles burst traffic effectively (up to bucket capacity)
- KV eventual consistency is acceptable for rate limiting (slight over-limit is better than blocking valid requests)
- Minimal state: `{tokens: number, lastRefill: timestamp}`
**Alternatives considered**:
- Sliding window: Rejected - more complex state management
- Fixed window: Rejected - doesn't handle bursts well

### IP Address Extraction
**Decision**: Use Cloudflare's CF-Connecting-IP header with fallback  
**Rationale**:
- Cloudflare Workers automatically provide real IP via CF-Connecting-IP
- Standard X-Forwarded-For is available as fallback
- Handles proxy chains correctly in Cloudflare environment
**Alternatives considered**:
- Direct socket IP: Rejected - not available in Workers environment
- User agent hashing: Rejected - easily spoofed

### Error Response Strategy
**Decision**: HTTP 429 with Retry-After header following existing error patterns  
**Rationale**:
- Follows HTTP standards for rate limiting
- Existing error middleware handles consistent JSON error format
- Retry-After helps clients implement exponential backoff
**Alternatives considered**:
- HTTP 503: Rejected - implies service unavailability
- Custom status codes: Rejected - non-standard

### KV Failure Handling (Fail-Open)
**Decision**: Catch KV errors and allow request through with warning log  
**Rationale**:
- Spec requirement: fail-open when KV unavailable
- Better to allow potential abuse than block legitimate traffic
- Structured logging captures failure for monitoring
**Alternatives considered**:
- Fail-closed: Rejected - violates spec requirement
- In-memory fallback: Rejected - adds complexity without persistence

### Performance Considerations
**Decision**: Minimize KV operations with atomic read-modify-write pattern  
**Rationale**:
- Single KV get/put per request minimizes latency
- Atomic operations prevent race conditions
- TTL-based cleanup reduces storage overhead
**Alternatives considered**:
- Multiple KV operations: Rejected - increases latency
- Background cleanup: Rejected - adds complexity

### Testing Strategy
**Decision**: Use Cloudflare Workers testing environment with mock KV  
**Rationale**:
- Bun test framework can mock Cloudflare environment
- Real KV operations in integration tests
- Contract tests ensure middleware interface compliance
**Alternatives considered**:
- Unit tests only: Rejected - doesn't test KV integration
- End-to-end only: Rejected - slow feedback loop

## Technical Approach Summary

1. **Middleware Integration**: Add rate limiting middleware to global middleware chain after logging, before authentication
2. **KV Structure**: Single namespace `RATE_LIMIT_KV` with keys `ip:{hash}`, values `{tokens, lastRefill, ttl}`
3. **Token Bucket Logic**: Refill tokens based on time elapsed, consume on request, persist state
4. **IP Identification**: CF-Connecting-IP header with X-Forwarded-For fallback
5. **Error Handling**: HTTP 429 with structured JSON error, fail-open on KV errors
6. **Configuration**: Environment variables for rate limits (10/min per IP, 100/min global)

## Integration Points

- **Router**: Add `rateLimitMiddleware` to global middleware chain
- **Environment**: Add `RATE_LIMIT_KV` binding to `wrangler.toml`
- **Types**: Extend environment types with KV namespace
- **Logging**: Integrate with existing structured logging system
- **Error Handling**: Use existing error middleware patterns