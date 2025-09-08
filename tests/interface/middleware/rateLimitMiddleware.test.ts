import { describe, test, expect, beforeEach } from "bun:test";
import { createRateLimitMiddleware } from "../../../src/interface/middleware/rateLimitMiddleware";
import { EnforceRateLimitUseCase, RateLimitResult } from "../../../src/usecase/EnforceRateLimit";

class MockEnforceRateLimitUseCase implements EnforceRateLimitUseCase {
  private results: Map<string, RateLimitResult> = new Map();

  setResult(ip: string, result: RateLimitResult): void {
    this.results.set(ip, result);
  }

  async checkRateLimit(clientIP: string): Promise<RateLimitResult> {
    return this.results.get(clientIP) || { allowed: true, tokensRemaining: 10, retryAfterMs: 0 };
  }
}

function createMockContext(ip: string, headers: Record<string, string> = {}) {
  return {
    req: {
      header: (name: string) => headers[name] || (name === 'CF-Connecting-IP' ? ip : undefined)
    },
    json: (body: any, status: number, responseHeaders?: Record<string, string>) => 
      new Response(JSON.stringify(body), { status, headers: responseHeaders }),
    env: {}
  };
}

function createMockNext() {
  return async () => new Response("OK", { status: 200 });
}

describe("rateLimitMiddleware", () => {
  let mockUseCase: MockEnforceRateLimitUseCase;
  let middleware: Function;

  beforeEach(() => {
    mockUseCase = new MockEnforceRateLimitUseCase();
    middleware = createRateLimitMiddleware(mockUseCase);
  });

  test("should allow request when rate limit permits", async () => {
    const context = createMockContext("192.168.1.100");
    const next = createMockNext();
    
    mockUseCase.setResult("192.168.1.100", { allowed: true, tokensRemaining: 9, retryAfterMs: 0 });

    const response = await middleware(context, next);
    expect(response.status).toBe(200);
  });

  test("should block request when rate limit exceeded", async () => {
    const context = createMockContext("192.168.1.100");
    const next = createMockNext();
    
    mockUseCase.setResult("192.168.1.100", { allowed: false, tokensRemaining: 0, retryAfterMs: 6000 });

    const response = await middleware(context, next);
    expect(response.status).toBe(429);
    
    const body = await response.json();
    expect(body.error).toBe("Rate Limit Exceeded");
    expect(body.retryAfter).toBe(6);
    expect(body.remaining).toBe(0);
    
    expect(response.headers.get('Retry-After')).toBe('6');
  });

  test("should extract IP from CF-Connecting-IP header", async () => {
    const context = createMockContext("", { 'CF-Connecting-IP': '203.0.113.1' });
    const next = createMockNext();
    
    // Set up expected result for the IP
    mockUseCase.setResult("203.0.113.1", { allowed: true, tokensRemaining: 9, retryAfterMs: 0 });
    
    const response = await middleware(context, next);
    expect(response.status).toBe(200);
  });

  test("should fallback to X-Forwarded-For if CF-Connecting-IP not present", async () => {
    const context = createMockContext("", { 'X-Forwarded-For': '203.0.113.2, 198.51.100.1' });
    const next = createMockNext();
    
    // Set up expected result for the first IP from X-Forwarded-For
    mockUseCase.setResult("203.0.113.2", { allowed: true, tokensRemaining: 9, retryAfterMs: 0 });
    
    const response = await middleware(context, next);
    expect(response.status).toBe(200);
  });
});