// Infrastructure Layer - KV Storage Implementation

import { RateLimitRepository, TokenBucket, TokenBucketState } from "../domain/RateLimit";

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