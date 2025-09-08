/**
 * KV Storage Contract for Rate Limiting
 * 
 * Defines the expected structure and operations for storing rate limit
 * data in Cloudflare KV storage.
 */

// KV Key naming convention
export const KV_KEY_PATTERNS = {
  // Individual client rate limit state
  CLIENT_BUCKET: "rate_limit:ip:{ip_hash}",
  
  // Future enhancement: global rate limit counter
  GLOBAL_COUNTER: "rate_limit:global",
} as const;

// KV Value structures
export interface TokenBucketKVValue {
  tokens: number;        // Current tokens (0-10)
  lastRefill: number;    // Unix timestamp in seconds
  capacity: number;      // Always 10 for IP buckets
}

// KV Storage operations contract
export interface RateLimitKVContract {
  // Key generation
  generateClientKey: (ipAddress: string) => Promise<string>;
  
  // Basic KV operations
  getBucket: (kv: KVNamespace, key: string) => Promise<TokenBucketKVValue | null>;
  setBucket: (kv: KVNamespace, key: string, value: TokenBucketKVValue, ttlSeconds?: number) => Promise<void>;
  
  // Atomic operations (read-modify-write)
  updateBucket: (
    kv: KVNamespace, 
    key: string, 
    updater: (current: TokenBucketKVValue | null) => TokenBucketKVValue
  ) => Promise<TokenBucketKVValue>;
}

// KV Error handling
export interface KVErrorContract {
  // Error types that can occur
  errorTypes: {
    KV_UNAVAILABLE: "kv_unavailable";
    KV_TIMEOUT: "kv_timeout"; 
    INVALID_DATA: "invalid_data";
    QUOTA_EXCEEDED: "quota_exceeded";
  };
  
  // Error handling strategy
  handleKVError: (error: unknown) => {
    type: string;
    message: string;
    shouldFailOpen: boolean;
  };
}

// Storage configuration
export interface KVStorageConfig {
  // TTL for inactive buckets (5 minutes)
  BUCKET_TTL_SECONDS: 300;
  
  // Maximum key length (KV limit is 512 bytes)
  MAX_KEY_LENGTH: 64;
  
  // Maximum value size (we use ~100 bytes, KV limit is 25MB)
  MAX_VALUE_SIZE: 1024;
  
  // Operation timeout (Cloudflare Workers have 30s limit)
  OPERATION_TIMEOUT_MS: 5000;
}

// Test helpers for KV operations
export interface KVTestContract {
  // Mock KV for testing
  createMockKV: (initialData?: Record<string, string>) => MockKVNamespace;
  
  // Validate KV data format
  validateBucketValue: (value: unknown) => value is TokenBucketKVValue;
  
  // Create test bucket state
  createTestBucket: (overrides?: Partial<TokenBucketKVValue>) => TokenBucketKVValue;
}

// Mock KV implementation for tests
export interface MockKVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; cursor?: string }): Promise<{
    keys: Array<{ name: string; expiration?: number }>;
    list_complete: boolean;
    cursor?: string;
  }>;
}

// Expected KV performance characteristics  
export interface KVPerformanceContract {
  // Latency expectations (Cloudflare KV global average)
  expectedLatency: {
    get: { p50: 50, p95: 200 }; // milliseconds
    put: { p50: 100, p95: 400 }; // milliseconds
  };
  
  // Consistency model
  consistency: "eventual"; // KV is eventually consistent
  
  // Geographic distribution
  distribution: "global"; // Available from all Cloudflare edge locations
}