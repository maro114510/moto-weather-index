# Quickstart: KV Token Bucket Rate Limiting

## Overview
This guide demonstrates the rate limiting middleware functionality through automated test scenarios that validate the acceptance criteria from the feature specification.

## Prerequisites
- Bun test framework configured
- Mock Cloudflare KV environment  
- Rate limiting middleware implemented
- Test utilities set up

## Test Scenarios

### Scenario 1: New Client First Request
**Given** a client has not made recent requests  
**When** they make a request  
**Then** the request is processed normally

```bash
# Run the test
bun test tests/middleware/rateLimiter.test.ts --match "new client first request"

# Expected behavior:
# - KV GET returns null (no existing bucket)
# - New bucket created with 10 tokens
# - Request allowed through (tokens: 9 remaining)
# - KV PUT stores new bucket state
```

### Scenario 2: Client Within Rate Limits  
**Given** a client is making requests within rate limits  
**When** they continue making requests  
**Then** all requests are processed successfully

```bash
# Run the test
bun test tests/middleware/rateLimiter.test.ts --match "client within limits"

# Expected behavior:
# - Multiple requests (up to 10) all succeed
# - Each request decrements token count
# - Token refill occurs based on time elapsed
# - All responses return HTTP 200
```

### Scenario 3: Rate Limit Exceeded
**Given** a client has exceeded their rate limit  
**When** they make additional requests  
**Then** they receive a rate limit error response

```bash
# Run the test  
bun test tests/middleware/rateLimiter.test.ts --match "rate limit exceeded"

# Expected behavior:
# - 11th request in 1 minute returns HTTP 429
# - Response includes Retry-After header
# - Error message explains rate limit
# - Subsequent requests also blocked until reset
```

### Scenario 4: Token Replenishment
**Given** a client was rate limited  
**When** sufficient time passes for token replenishment  
**Then** they can make requests again

```bash
# Run the test
bun test tests/middleware/rateLimiter.test.ts --match "token replenishment"

# Expected behavior:
# - After 6 seconds (1 token refill), 1 request allowed
# - After 60 seconds (full refill), 10 requests allowed
# - Token bucket state correctly updated in KV
```

### Scenario 5: Independent Client Limits
**Given** the system is under high load  
**When** multiple clients make concurrent requests  
**Then** each client's rate limit is enforced independently

```bash  
# Run the test
bun test tests/integration/rateLimitIntegration.test.ts --match "independent limits"

# Expected behavior:
# - Client A can use 10 requests
# - Client B can also use 10 requests  
# - Limits are per IP address, not global
# - KV stores separate buckets per client
```

## Edge Case Testing

### KV Storage Unavailable
**When** KV storage is temporarily unavailable  
**Then** requests are allowed through (fail-open behavior)

```bash
bun test tests/middleware/rateLimiter.test.ts --match "kv unavailable"

# Expected behavior:
# - KV GET throws error
# - Request allowed through with warning log
# - No KV PUT attempted
# - Next request retries KV operations
```

### Invalid KV Data
**When** KV contains corrupted rate limit data  
**Then** bucket is reset to initial state

```bash
bun test tests/middleware/rateLimiter.test.ts --match "invalid data"

# Expected behavior:  
# - Invalid JSON or missing fields detected
# - New bucket created with 10 tokens
# - Request processed normally
# - Corrupted data overwritten
```

### System Startup
**When** system starts with no existing rate limit data  
**Then** all clients start with fresh buckets

```bash
bun test tests/integration/startupBehavior.test.ts

# Expected behavior:
# - Empty KV namespace
# - First requests from any IP create new buckets
# - All buckets start with full token capacity
```

## Integration Validation

### Full Request Flow
Test the complete middleware integration:

```bash
# Run integration tests
bun test tests/integration/

# Tests validate:
# - Middleware properly integrated in request chain
# - Headers correctly extracted (CF-Connecting-IP)
# - Error responses match existing error format
# - Logging follows structured format
# - Performance meets latency requirements
```

### Environment Configuration

```bash
# Test with different KV bindings
RATE_LIMIT_KV="test-namespace" bun test

# Verify environment variable handling
NODE_ENV=development bun test # Should allow unlimited requests
NODE_ENV=production bun test  # Should enforce limits
```

## Performance Validation

### Latency Impact
```bash
# Measure middleware overhead
bun test tests/performance/latency.test.ts

# Expected results:
# - <10ms average middleware execution time
# - <5ms token bucket calculation  
# - <15ms total per-request overhead
```

### Memory Usage
```bash  
# Monitor memory consumption
bun test tests/performance/memory.test.ts

# Expected results:
# - <1KB per request processing
# - No memory leaks over 1000 requests
# - Garbage collection handles token objects
```

## Manual Testing

For manual verification during development:

```bash
# Start development server
task dev

# Test rate limiting manually:
curl -H "CF-Connecting-IP: 192.168.1.100" http://localhost:3000/api/v1/health

# Repeat 11 times quickly to trigger rate limit:
for i in {1..11}; do
  curl -H "CF-Connecting-IP: 192.168.1.100" http://localhost:3000/api/v1/health
  echo "Request $i"
done

# Expected: First 10 succeed, 11th returns 429
```

## Success Criteria Validation

✅ **All acceptance scenarios pass**  
✅ **Edge cases handled gracefully**  
✅ **Performance requirements met**  
✅ **Integration tests confirm middleware behavior**  
✅ **Manual testing demonstrates rate limiting**

The quickstart is complete when all test scenarios pass and manual validation confirms the middleware is working as specified.