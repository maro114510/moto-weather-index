import { describe, expect, test } from "bun:test";
import { ClientIdentity, RateLimitPolicy, TokenBucket } from "../../src/domain/RateLimit";

describe("TokenBucket", () => {
  test("should create bucket with full capacity", () => {
    const bucket = TokenBucket.create(10);
    expect(bucket.availableTokens).toBe(10);
    expect(bucket.bucketCapacity).toBe(10);
  });

  test("should consume token successfully", () => {
    const bucket = TokenBucket.create(10);
    const consumed = bucket.consumeToken();
    expect(consumed).toBe(true);
    expect(bucket.availableTokens).toBe(9);
  });

  test("should fail to consume when empty", () => {
    const bucket = TokenBucket.create(0);
    const consumed = bucket.consumeToken();
    expect(consumed).toBe(false);
    expect(bucket.availableTokens).toBe(0);
  });

  test("should refill tokens based on time", () => {
    const policy = RateLimitPolicy.create(10); // 6000ms per token
    const pastTime = new Date(Date.now() - 12000); // 2 tokens worth
    const bucket = TokenBucket.fromState(5, pastTime, 10);
    
    bucket.refill(policy);
    expect(bucket.availableTokens).toBe(7);
  });

  test("should not refill beyond capacity", () => {
    const policy = RateLimitPolicy.create(10);
    const pastTime = new Date(Date.now() - 60000); // 10+ tokens worth
    const bucket = TokenBucket.fromState(8, pastTime, 10);
    
    bucket.refill(policy);
    expect(bucket.availableTokens).toBe(10);
  });
});

describe("RateLimitPolicy", () => {
  test("should create standard IP policy", () => {
    const policy = RateLimitPolicy.standardIPPolicy();
    expect(policy.requestsPerMinute).toBe(10);
    expect(policy.bucketCapacity).toBe(10);
    expect(policy.refillIntervalMs).toBe(6000);
  });

  test("should calculate refill time", () => {
    const policy = RateLimitPolicy.create(10);
    const refillTime = policy.calculateRefillTime(2);
    expect(refillTime).toBe(12000); // 2 * 6000ms
  });

  test("should validate policy parameters", () => {
    expect(() => RateLimitPolicy.create(0)).toThrow();
    expect(() => RateLimitPolicy.create(-1)).toThrow();
  });
});

describe("ClientIdentity", () => {
  test("should normalize IP address", async () => {
    const identity = await ClientIdentity.fromIP("192.168.1.100:8080");
    expect(identity.normalizedIP).toBe("192.168.1.100");
  });

  test("should generate consistent key hash", async () => {
    const identity1 = await ClientIdentity.fromIP("192.168.1.100");
    const identity2 = await ClientIdentity.fromIP("192.168.1.100");
    expect(identity1.keyHash).toBe(identity2.keyHash);
  });

  test("should generate KV key with prefix", async () => {
    const identity = await ClientIdentity.fromIP("192.168.1.100");
    expect(identity.kvKey).toMatch(/^rate_limit:ip:[a-f0-9]{16}$/);
  });
});