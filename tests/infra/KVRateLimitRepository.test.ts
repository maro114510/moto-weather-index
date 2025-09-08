import { describe, test, expect, beforeEach } from "bun:test";
import { KVRateLimitRepository } from "../../src/infra/KVRateLimitRepository";
import { TokenBucket } from "../../src/domain/RateLimit";

class MockKVNamespace implements KVNamespace {
  private storage = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.storage.get(key) || null;
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    this.storage.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async list(): Promise<any> {
    return { keys: [], list_complete: true };
  }

  clear(): void {
    this.storage.clear();
  }
}

describe("KVRateLimitRepository", () => {
  let mockKV: MockKVNamespace;
  let repository: KVRateLimitRepository;

  beforeEach(() => {
    mockKV = new MockKVNamespace();
    repository = new KVRateLimitRepository(mockKV, 300);
  });

  test("should return null for non-existent bucket", async () => {
    const bucket = await repository.getBucket("test-key");
    expect(bucket).toBeNull();
  });

  test("should save and retrieve bucket", async () => {
    const bucket = TokenBucket.create(10);
    await repository.saveBucket("test-key", bucket);
    
    const retrieved = await repository.getBucket("test-key");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.availableTokens).toBe(10);
    expect(retrieved?.bucketCapacity).toBe(10);
  });

  test("should handle invalid JSON gracefully", async () => {
    await mockKV.put("test-key", "invalid-json");
    
    const bucket = await repository.getBucket("test-key");
    expect(bucket).toBeNull();
  });

  test("should handle KV errors gracefully", async () => {
    const failingKV: KVNamespace = {
      get: async () => { throw new Error("KV error"); },
      put: async () => { throw new Error("KV error"); },
      delete: async () => { throw new Error("KV error"); },
      list: async () => { throw new Error("KV error"); }
    };

    const failingRepo = new KVRateLimitRepository(failingKV, 300);
    
    const bucket = await failingRepo.getBucket("test-key");
    expect(bucket).toBeNull();
    
    // Should not throw
    await failingRepo.saveBucket("test-key", TokenBucket.create(10));
  });
});