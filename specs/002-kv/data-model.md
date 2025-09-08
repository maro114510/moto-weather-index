# Data Model: KV Token Bucket Rate Limiting (Clean Architecture)

## Domain Layer Entities

### TokenBucket (Domain Entity)
**Purpose**: Core domain entity representing token bucket state with business rules  
**Layer**: Domain (`src/domain/RateLimit.ts`)  
**Responsibility**: Token allocation, refill logic, invariant validation

```typescript
// Domain Entity
export class TokenBucket {
  private constructor(
    private tokens: number,
    private lastRefill: Date,
    private readonly capacity: number
  ) {
    this.validateInvariants();
  }

  static create(capacity: number): TokenBucket {
    return new TokenBucket(capacity, new Date(), capacity);
  }

  static fromState(tokens: number, lastRefill: Date, capacity: number): TokenBucket {
    return new TokenBucket(tokens, lastRefill, capacity);
  }

  // Business Rules
  consumeToken(): boolean {
    if (this.tokens <= 0) return false;
    this.tokens -= 1;
    return true;
  }

  refill(policy: RateLimitPolicy, currentTime: Date = new Date()): void {
    const timeDelta = currentTime.getTime() - this.lastRefill.getTime();
    const tokensToAdd = Math.floor(timeDelta / policy.refillIntervalMs);
    
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = currentTime;
    }
  }

  // Getters for read-only access
  get availableTokens(): number { return this.tokens; }
  get bucketCapacity(): number { return this.capacity; }
  get lastRefillTime(): Date { return new Date(this.lastRefill); }

  private validateInvariants(): void {
    if (this.tokens < 0 || this.tokens > this.capacity) {
      throw new Error('TokenBucket invariant violation: invalid token count');
    }
  }

  // For persistence (Infrastructure layer)
  toState(): TokenBucketState {
    return {
      tokens: this.tokens,
      lastRefill: this.lastRefill.getTime(),
      capacity: this.capacity
    };
  }
}

// Data structure for persistence (Infrastructure)
export interface TokenBucketState {
  tokens: number;
  lastRefill: number; // Unix timestamp
  capacity: number;
}
```

### RateLimitPolicy (Value Object)
**Purpose**: Immutable business rules for rate limiting configuration  
**Layer**: Domain (`src/domain/RateLimit.ts`)  
**Responsibility**: Rate limiting parameters and derived calculations

```typescript
// Domain Value Object
export class RateLimitPolicy {
  private constructor(
    public readonly requestsPerMinute: number,
    public readonly bucketCapacity: number,
    public readonly refillIntervalMs: number
  ) {
    this.validatePolicy();
  }

  static create(requestsPerMinute: number, bucketCapacity?: number): RateLimitPolicy {
    const capacity = bucketCapacity ?? requestsPerMinute; // Default: same as rate limit
    const refillInterval = (60 * 1000) / requestsPerMinute; // Time per token in ms
    
    return new RateLimitPolicy(requestsPerMinute, capacity, refillInterval);
  }

  // Standard policy for IP-based rate limiting
  static standardIPPolicy(): RateLimitPolicy {
    return RateLimitPolicy.create(10, 10); // 10 requests/minute, 10 token capacity
  }

  private validatePolicy(): void {
    if (this.requestsPerMinute <= 0 || this.bucketCapacity <= 0) {
      throw new Error('Rate limit policy must have positive values');
    }
    if (this.bucketCapacity < this.requestsPerMinute) {
      throw new Error('Bucket capacity should be >= requests per minute for burst handling');
    }
  }

  // Business logic: Calculate expected refill time for given tokens
  calculateRefillTime(tokensNeeded: number): number {
    return tokensNeeded * this.refillIntervalMs;
  }
}
```

### ClientIdentity (Value Object)
**Purpose**: Unique identification and normalization of clients  
**Layer**: Domain (`src/domain/RateLimit.ts`)  
**Responsibility**: Client identification and key generation

```typescript
// Domain Value Object
export class ClientIdentity {
  private constructor(
    public readonly normalizedIP: string,
    public readonly keyHash: string
  ) {}

  static async fromIP(rawIP: string): Promise<ClientIdentity> {
    const normalized = this.normalizeIP(rawIP);
    const keyHash = await this.generateKeyHash(normalized);
    
    return new ClientIdentity(normalized, keyHash);
  }

  private static normalizeIP(ip: string): string {
    // Remove port numbers, normalize IPv6, etc.
    return ip.split(':')[0].toLowerCase().trim();
  }

  private static async generateKeyHash(ip: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(ip);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
  }

  get kvKey(): string {
    return `rate_limit:ip:${this.keyHash}`;
  }
}
```

## Use Case Layer

### EnforceRateLimit Use Case
**Purpose**: Core application logic for rate limit enforcement  
**Layer**: UseCase (`src/usecase/EnforceRateLimit.ts`)  
**Responsibility**: Orchestrate domain objects and infrastructure

```typescript
// Use Case
export class EnforceRateLimitUseCase {
  constructor(
    private rateLimitRepository: RateLimitRepository,
    private policy: RateLimitPolicy
  ) {}

  async checkRateLimit(clientIP: string): Promise<RateLimitResult> {
    try {
      // 1. Create domain objects
      const clientIdentity = await ClientIdentity.fromIP(clientIP);
      
      // 2. Load or create token bucket
      let bucket = await this.rateLimitRepository.getBucket(clientIdentity.kvKey);
      if (!bucket) {
        bucket = TokenBucket.create(this.policy.bucketCapacity);
      }
      
      // 3. Apply business rules
      bucket.refill(this.policy);
      const allowed = bucket.consumeToken();
      
      // 4. Persist state
      await this.rateLimitRepository.saveBucket(clientIdentity.kvKey, bucket);
      
      // 5. Return result
      return {
        allowed,
        tokensRemaining: bucket.availableTokens,
        retryAfterMs: allowed ? 0 : this.policy.calculateRefillTime(1)
      };
      
    } catch (error) {
      // Fail-open: allow request on any error
      return { allowed: true, tokensRemaining: 0, retryAfterMs: 0 };
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  tokensRemaining: number;
  retryAfterMs: number;
}
```

## Infrastructure Layer

### RateLimitRepository (Interface)
**Purpose**: Abstract repository for token bucket persistence  
**Layer**: Domain (`src/domain/RateLimit.ts`) - Interface  
**Implementation**: Infrastructure (`src/infra/KVRateLimitRepository.ts`)

```typescript
// Domain Interface (Dependency Inversion)
export interface RateLimitRepository {
  getBucket(key: string): Promise<TokenBucket | null>;
  saveBucket(key: string, bucket: TokenBucket): Promise<void>;
}

// Infrastructure Implementation
export class KVRateLimitRepository implements RateLimitRepository {
  constructor(
    private kv: KVNamespace,
    private ttlSeconds: number = 300 // 5 minutes
  ) {}

  async getBucket(key: string): Promise<TokenBucket | null> {
    try {
      const data = await this.kv.get(key);
      if (!data) return null;
      
      const state: TokenBucketState = JSON.parse(data);
      return TokenBucket.fromState(
        state.tokens,
        new Date(state.lastRefill),
        state.capacity
      );
    } catch (error) {
      // Log error but return null for graceful degradation
      console.warn('Failed to load token bucket:', error);
      return null;
    }
  }

  async saveBucket(key: string, bucket: TokenBucket): Promise<void> {
    try {
      const state = bucket.toState();
      await this.kv.put(key, JSON.stringify(state), {
        expirationTtl: this.ttlSeconds
      });
    } catch (error) {
      // Log error but don't throw (fail-open behavior)
      console.warn('Failed to save token bucket:', error);
    }
  }
}
```

## Interface Layer

### Rate Limit Middleware
**Purpose**: Hono middleware integration following existing patterns  
**Layer**: Interface (`src/interface/middleware/rateLimitMiddleware.ts`)  
**Responsibility**: HTTP request/response handling, IP extraction

```typescript
// Interface Layer - Middleware
export function createRateLimitMiddleware(
  enforceRateLimitUseCase: EnforceRateLimitUseCase
): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    // 1. Extract client IP (Cloudflare Workers pattern)
    const clientIP = extractClientIP(c);
    
    // 2. Apply use case
    const result = await enforceRateLimitUseCase.checkRateLimit(clientIP);
    
    // 3. Handle result
    if (!result.allowed) {
      return c.json(
        {
          error: "Rate Limit Exceeded",
          message: "Too many requests. Please try again later.",
          retryAfter: Math.ceil(result.retryAfterMs / 1000),
          limit: 10,
          remaining: result.tokensRemaining,
          resetTime: Date.now() + result.retryAfterMs
        },
        429,
        {
          'Retry-After': String(Math.ceil(result.retryAfterMs / 1000))
        }
      );
    }
    
    // 4. Continue request pipeline
    return next();
  };
}

function extractClientIP(c: Context): string {
  return c.req.header('CF-Connecting-IP') 
    || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() 
    || c.env.REMOTE_ADDR 
    || '127.0.0.1';
}
```

## Dependency Injection Configuration

### DI Container Updates
**File**: `src/di/container.ts`  
**Pattern**: Follow existing factory function pattern

```typescript
// Add to existing container.ts
export function createRateLimitRepository(kv: KVNamespace): RateLimitRepository {
  return new KVRateLimitRepository(kv, 300); // 5 minute TTL
}

export function createEnforceRateLimitUseCase(
  repository: RateLimitRepository,
  policy?: RateLimitPolicy
): EnforceRateLimitUseCase {
  const rateLimitPolicy = policy || RateLimitPolicy.standardIPPolicy();
  return new EnforceRateLimitUseCase(repository, rateLimitPolicy);
}

// Factory for complete middleware setup
export function createRateLimitMiddleware(kv: KVNamespace): MiddlewareHandler {
  const repository = createRateLimitRepository(kv);
  const useCase = createEnforceRateLimitUseCase(repository);
  return createRateLimitMiddleware(useCase);
}
```

### Middleware Registration
**File**: `src/interface/router.ts`  
**Integration**: Add to existing middleware chain

```typescript
// Add to existing router.ts imports
import { createRateLimitMiddleware } from '../di/container';

// Modify middleware chain (after logging, before auth)
app.use("*", corsMiddleware);
app.use("*", loggingMiddleware);
app.use("*", createRateLimitMiddleware(process.env.RATE_LIMIT_KV)); // NEW
app.use("*", errorHandlingMiddleware);
```

## Environment Configuration

### KV Binding Setup
**File**: `wrangler.toml`  
**Addition**: New KV namespace for rate limiting

```toml
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "rate-limit-namespace-id-here"
```

### TypeScript Environment Types
**File**: `src/types/bun.d.ts` (or similar)

```typescript
declare global {
  interface Env {
    RATE_LIMIT_KV: KVNamespace;
    // ... existing bindings
  }
}
```

## Error States

### KV Unavailable
**Behavior**: Fail-open (allow request through)
**Logging**: Warning level with structured context
**Recovery**: Automatic on next request when KV is available

### Invalid Data
**Behavior**: Reset bucket to initial state
**Logging**: Info level with data corruption details
**Recovery**: Initialize new bucket with full tokens

### Rate Limit Exceeded
**Behavior**: Return HTTP 429 with structured error
**Headers**: Include `Retry-After` with seconds until next token
**Logging**: Debug level (expected behavior, not an error)

## Performance Characteristics

### KV Operations per Request
- **Normal flow**: 1 GET + 1 PUT (read-modify-write)
- **New client**: 1 GET (miss) + 1 PUT (initialize)
- **Error flow**: 1 GET only (on KV failure)

### Memory Usage
- **Per request**: ~200 bytes (bucket state + metadata)
- **Persistent**: Zero (all state in KV)

### Latency Impact
- **KV operations**: ~5-10ms combined
- **Token calculation**: ~1ms
- **Total overhead**: <15ms per request