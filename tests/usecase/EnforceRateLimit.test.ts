import { describe, test, expect, beforeEach } from "bun:test";
import { EnforceRateLimitUseCase, RateLimitResult } from "../../src/usecase/EnforceRateLimit";
import { TokenBucket, RateLimitPolicy, RateLimitRepository } from "../../src/domain/RateLimit";

class MockRateLimitRepository implements RateLimitRepository {
  private storage = new Map<string, TokenBucket>();

  async getBucket(key: string): Promise<TokenBucket | null> {
    return this.storage.get(key) || null;
  }

  async saveBucket(key: string, bucket: TokenBucket): Promise<void> {
    this.storage.set(key, bucket);
  }

  clear(): void {
    this.storage.clear();
  }
}

describe("EnforceRateLimitUseCase", () => {
  let repository: MockRateLimitRepository;
  let policy: RateLimitPolicy;
  let useCase: EnforceRateLimitUseCase;

  beforeEach(() => {
    repository = new MockRateLimitRepository();
    policy = RateLimitPolicy.standardIPPolicy();
    useCase = new EnforceRateLimitUseCase(repository, policy);
  });

  test("should allow first request for new client", async () => {
    const result = await useCase.checkRateLimit("192.168.1.100");
    
    expect(result.allowed).toBe(true);
    expect(result.tokensRemaining).toBe(9);
    expect(result.retryAfterMs).toBe(0);
  });

  test("should enforce rate limit when tokens exhausted", async () => {
    // Exhaust tokens
    for (let i = 0; i < 10; i++) {
      await useCase.checkRateLimit("192.168.1.100");
    }
    
    const result = await useCase.checkRateLimit("192.168.1.100");
    expect(result.allowed).toBe(false);
    expect(result.tokensRemaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  test("should handle different clients independently", async () => {
    const result1 = await useCase.checkRateLimit("192.168.1.100");
    const result2 = await useCase.checkRateLimit("192.168.1.101");
    
    expect(result1.allowed).toBe(true);
    expect(result2.allowed).toBe(true);
    expect(result1.tokensRemaining).toBe(9);
    expect(result2.tokensRemaining).toBe(9);
  });

  test("should fail open when repository throws error", async () => {
    const failingRepo: RateLimitRepository = {
      getBucket: async () => { throw new Error("KV unavailable"); },
      saveBucket: async () => { throw new Error("KV unavailable"); }
    };
    
    const failOpenUseCase = new EnforceRateLimitUseCase(failingRepo, policy);
    const result = await failOpenUseCase.checkRateLimit("192.168.1.100");
    
    expect(result.allowed).toBe(true);
    expect(result.tokensRemaining).toBe(0);
    expect(result.retryAfterMs).toBe(0);
  });
});