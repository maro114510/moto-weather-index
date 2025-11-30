// Domain Layer - Rate Limiting Entities and Value Objects

export interface TokenBucketState {
  tokens: number;
  lastRefill: number; // Unix timestamp
  capacity: number;
}

export class TokenBucket {
  private constructor(
    private tokens: number,
    private lastRefill: Date,
    private readonly capacity: number,
  ) {
    this.validateInvariants();
  }

  static create(capacity: number): TokenBucket {
    return new TokenBucket(capacity, new Date(), capacity);
  }

  static fromState(
    tokens: number,
    lastRefill: Date,
    capacity: number,
  ): TokenBucket {
    return new TokenBucket(tokens, lastRefill, capacity);
  }

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

  get availableTokens(): number {
    return this.tokens;
  }
  get bucketCapacity(): number {
    return this.capacity;
  }
  get lastRefillTime(): Date {
    return new Date(this.lastRefill);
  }

  private validateInvariants(): void {
    if (this.tokens < 0 || this.tokens > this.capacity) {
      throw new Error("TokenBucket invariant violation: invalid token count");
    }
  }

  toState(): TokenBucketState {
    return {
      tokens: this.tokens,
      lastRefill: this.lastRefill.getTime(),
      capacity: this.capacity,
    };
  }
}

export class RateLimitPolicy {
  private constructor(
    public readonly requestsPerMinute: number,
    public readonly bucketCapacity: number,
    public readonly refillIntervalMs: number,
  ) {
    this.validatePolicy();
  }

  static create(
    requestsPerMinute: number,
    bucketCapacity?: number,
  ): RateLimitPolicy {
    const capacity = bucketCapacity ?? requestsPerMinute;
    const refillInterval = (60 * 1000) / requestsPerMinute;

    return new RateLimitPolicy(requestsPerMinute, capacity, refillInterval);
  }

  static standardIPPolicy(): RateLimitPolicy {
    return RateLimitPolicy.create(10, 10);
  }

  private validatePolicy(): void {
    if (this.requestsPerMinute <= 0 || this.bucketCapacity <= 0) {
      throw new Error("Rate limit policy must have positive values");
    }
    if (this.bucketCapacity < this.requestsPerMinute) {
      throw new Error(
        "Bucket capacity should be >= requests per minute for burst handling",
      );
    }
  }

  calculateRefillTime(tokensNeeded: number): number {
    return tokensNeeded * this.refillIntervalMs;
  }
}

export class ClientIdentity {
  private constructor(
    public readonly normalizedIP: string,
    public readonly keyHash: string,
  ) {}

  static async fromIP(rawIP: string): Promise<ClientIdentity> {
    const normalized = ClientIdentity.normalizeIP(rawIP);
    const keyHash = await ClientIdentity.generateKeyHash(normalized);

    return new ClientIdentity(normalized, keyHash);
  }

  private static normalizeIP(ip: string): string {
    return ip.split(":")[0].toLowerCase().trim();
  }

  private static async generateKeyHash(ip: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(ip);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .substring(0, 16);
  }

  get kvKey(): string {
    return `rate_limit:ip:${this.keyHash}`;
  }
}

// Repository Interface (Dependency Inversion)
export interface RateLimitRepository {
  getBucket(key: string): Promise<TokenBucket | null>;
  saveBucket(key: string, bucket: TokenBucket): Promise<void>;
}
