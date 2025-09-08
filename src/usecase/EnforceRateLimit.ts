// Use Case Layer - Rate Limit Enforcement Logic

import { ClientIdentity, RateLimitPolicy, RateLimitRepository, TokenBucket } from "../domain/RateLimit";

export interface RateLimitResult {
  allowed: boolean;
  tokensRemaining: number;
  retryAfterMs: number;
}

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