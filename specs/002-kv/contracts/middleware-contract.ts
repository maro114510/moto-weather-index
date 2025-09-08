/**
 * Rate Limiting Clean Architecture Contracts
 * 
 * This file defines the interfaces for each layer in the Clean Architecture
 * implementation of the rate limiting feature.
 */

import type { Context, Next } from "hono";

// Domain Layer Contracts
export interface TokenBucket {
  readonly availableTokens: number;
  readonly bucketCapacity: number;
  readonly lastRefillTime: Date;
  
  consumeToken(): boolean;
  refill(policy: RateLimitPolicy, currentTime?: Date): void;
  toState(): TokenBucketState;
}

export interface RateLimitPolicy {
  readonly requestsPerMinute: number;
  readonly bucketCapacity: number;
  readonly refillIntervalMs: number;
  
  calculateRefillTime(tokensNeeded: number): number;
}

export interface ClientIdentity {
  readonly normalizedIP: string;
  readonly keyHash: string;
  readonly kvKey: string;
}

// Use Case Layer Contracts
export interface EnforceRateLimitUseCase {
  checkRateLimit(clientIP: string): Promise<RateLimitResult>;
}

export interface RateLimitResult {
  allowed: boolean;
  tokensRemaining: number;
  retryAfterMs: number;
}

export interface RateLimitRepository {
  getBucket(key: string): Promise<TokenBucket | null>;
  saveBucket(key: string, bucket: TokenBucket): Promise<void>;
}

// Infrastructure Layer Contracts
export interface TokenBucketState {
  tokens: number;
  lastRefill: number; // Unix timestamp
  capacity: number;
}

// Interface Layer Contracts
export interface MiddlewareHandler {
  (c: Context, next: Next): Promise<Response | void>;
}

export interface Environment {
  RATE_LIMIT_KV: KVNamespace;
}

// Error response structure (HTTP 429)
export interface RateLimitErrorResponse {
  error: string;
  message: string;
  retryAfter: number;    // Seconds
  limit: number;
  remaining: number;
  resetTime: number;     // Unix timestamp
}

// Dependency Injection Contracts
export interface DIContainer {
  createRateLimitRepository(kv: KVNamespace): RateLimitRepository;
  createEnforceRateLimitUseCase(
    repository: RateLimitRepository, 
    policy?: RateLimitPolicy
  ): EnforceRateLimitUseCase;
  createRateLimitMiddleware(kv: KVNamespace): MiddlewareHandler;
}

// Testing Contracts (for mocking and testing)
export interface TestContracts {
  // Domain testing
  createTestTokenBucket(overrides?: Partial<TokenBucketState>): TokenBucket;
  createTestPolicy(requestsPerMinute?: number): RateLimitPolicy;
  createTestClientIdentity(ip?: string): Promise<ClientIdentity>;
  
  // Use case testing  
  createMockRepository(initialData?: Map<string, TokenBucket>): RateLimitRepository;
  
  // Infrastructure testing
  createMockKV(initialData?: Record<string, string>): KVNamespace;
  
  // Integration testing
  createTestMiddleware(kv: KVNamespace): MiddlewareHandler;
  createTestContext(ip: string, headers?: Record<string, string>): Context;
}

// Test helper interfaces
export interface MockKVNamespace {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>;
}

export interface TestScenario {
  name: string;
  setup: {
    kvData?: Record<string, string>;
    requestHeaders: Record<string, string>;
    currentTime: number;
  };
  expected: {
    allowed: boolean;
    statusCode: number;
    responseHeaders?: Record<string, string>;
    kvState?: Record<string, string>;
  };
}