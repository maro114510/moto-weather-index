# Tasks: KV Token Bucket Rate Limiting

**Input**: Design documents from `/specs/002-kv/`
**Prerequisites**: plan.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

## Execution Flow (main)
```
1. Load plan.md from feature directory ✓
   → Tech Stack: TypeScript, Bun, Hono, Cloudflare Workers, KV
   → Clean Architecture with Domain → UseCase → Infrastructure → Interface
2. Load design documents ✓
   → data-model.md: TokenBucket, RateLimitPolicy, ClientIdentity entities
   → contracts/: middleware-contract.ts, kv-storage-contract.ts
   → quickstart.md: 5 main test scenarios + edge cases
3. Generate tasks by Clean Architecture layers (inside-out)
   → Setup: Environment, dependencies, types
   → Domain: Tests → Entities and Value Objects [P]
   → UseCase: Tests → Use case implementation [P] 
   → Infrastructure: Tests → Repository implementation [P]
   → Interface: Tests → Middleware implementation
   → Integration: Full stack tests, DI configuration
   → Polish: Performance, documentation
4. Apply TDD rules: ALL tests before implementation
5. Apply Clean Architecture rules: Inner layers before outer layers
6. Mark [P] for parallel execution (different files)
7. SUCCESS: 22 tasks ready for execution
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- File paths are absolute from repository root

## Phase 3.1: Setup & Environment
- [ ] T001 Create environment types in `src/types/bun.d.ts` - add RATE_LIMIT_KV namespace binding
- [ ] T002 Add KV binding to `wrangler.toml` - new [[kv_namespaces]] with RATE_LIMIT_KV binding
- [ ] T003 [P] Configure TypeScript strict types for domain entities and value objects

## Phase 3.2: Domain Layer Tests (TDD - MUST FAIL FIRST) ⚠️
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [ ] T004 [P] TokenBucket entity test in `tests/domain/RateLimit.test.ts` - test token consumption, refill logic, invariant validation
- [ ] T005 [P] RateLimitPolicy value object test in `tests/domain/RateLimit.test.ts` - test policy creation, validation, refill calculations  
- [ ] T006 [P] ClientIdentity value object test in `tests/domain/RateLimit.test.ts` - test IP normalization, key generation, hashing

## Phase 3.3: Domain Layer Implementation (ONLY after tests are failing)
- [ ] T007 TokenBucket entity in `src/domain/RateLimit.ts` - implement business rules, invariants, state management
- [ ] T008 RateLimitPolicy value object in `src/domain/RateLimit.ts` - implement immutable configuration and calculations
- [ ] T009 ClientIdentity value object in `src/domain/RateLimit.ts` - implement IP normalization and key generation
- [ ] T010 RateLimitRepository interface in `src/domain/RateLimit.ts` - define repository contract for dependency inversion

## Phase 3.4: Use Case Layer Tests (TDD - MUST FAIL FIRST) ⚠️
- [ ] T011 [P] EnforceRateLimitUseCase test in `tests/usecase/EnforceRateLimit.test.ts` - test business logic orchestration, error handling, fail-open behavior

## Phase 3.5: Use Case Layer Implementation
- [ ] T012 EnforceRateLimitUseCase in `src/usecase/EnforceRateLimit.ts` - implement rate limit enforcement logic and error handling

## Phase 3.6: Infrastructure Layer Tests (TDD - MUST FAIL FIRST) ⚠️
- [ ] T013 [P] KVRateLimitRepository test in `tests/infra/KVRateLimitRepository.test.ts` - test KV operations, error handling, data serialization

## Phase 3.7: Infrastructure Layer Implementation  
- [ ] T014 KVRateLimitRepository in `src/infra/KVRateLimitRepository.ts` - implement concrete repository with KV storage and error handling

## Phase 3.8: Interface Layer Tests (TDD - MUST FAIL FIRST) ⚠️
- [ ] T015 Rate limit middleware test in `tests/interface/middleware/rateLimitMiddleware.test.ts` - test Hono integration, IP extraction, HTTP responses

## Phase 3.9: Interface Layer Implementation
- [ ] T016 Rate limit middleware in `src/interface/middleware/rateLimitMiddleware.ts` - implement Hono middleware with error responses

## Phase 3.10: Dependency Injection & Configuration
- [ ] T017 DI container extensions in `src/di/container.ts` - add factory functions for rate limit components
- [ ] T018 Router integration in `src/interface/router.ts` - add rate limit middleware to existing middleware chain

## Phase 3.11: Integration Tests (Full Stack Validation) ⚠️
- [ ] T019 [P] Integration test: New client first request in `tests/integration/rateLimitIntegration.test.ts` - validate complete flow
- [ ] T020 [P] Integration test: Client within limits in `tests/integration/rateLimitIntegration.test.ts` - validate multiple requests
- [ ] T021 [P] Integration test: Rate limit exceeded in `tests/integration/rateLimitIntegration.test.ts` - validate HTTP 429 responses
- [ ] T022 [P] Integration test: Token replenishment in `tests/integration/rateLimitIntegration.test.ts` - validate time-based recovery
- [ ] T023 [P] Integration test: Independent client limits in `tests/integration/rateLimitIntegration.test.ts` - validate per-IP isolation
- [ ] T024 [P] Integration test: KV failure scenarios in `tests/integration/rateLimitIntegration.test.ts` - validate fail-open behavior

## Phase 3.12: Polish & Performance
- [ ] T025 [P] Performance test: Middleware latency in `tests/performance/rateLimitPerformance.test.ts` - ensure <10ms overhead
- [ ] T026 Update CLAUDE.md documentation with rate limiting implementation details
- [ ] T027 Run quickstart validation scenarios to ensure all acceptance criteria pass

## Dependencies
**Clean Architecture Flow (Inner → Outer)**:
- Setup (T001-T003) → Domain Tests (T004-T006) → Domain Implementation (T007-T010)
- Domain Implementation → UseCase Tests (T011) → UseCase Implementation (T012)  
- UseCase Implementation → Infrastructure Tests (T013) → Infrastructure Implementation (T014)
- All layers → Interface Tests (T015) → Interface Implementation (T016)
- All implementations → DI/Configuration (T017-T018) → Integration Tests (T019-T024)
- Everything → Polish (T025-T027)

**TDD Flow**: Each test phase MUST complete and FAIL before corresponding implementation phase

## Parallel Execution Examples

### Domain Layer Parallel Tests (T004-T006):
```bash
# Launch all domain tests together (different test sections, same file):
Task: "TokenBucket entity test in tests/domain/RateLimit.test.ts"
Task: "RateLimitPolicy value object test in tests/domain/RateLimit.test.ts" 
Task: "ClientIdentity value object test in tests/domain/RateLimit.test.ts"
```

### Integration Tests Parallel (T019-T024):
```bash
# Launch all integration scenarios together (different test cases, same file):
Task: "Integration test: New client first request"
Task: "Integration test: Client within limits"
Task: "Integration test: Rate limit exceeded"
Task: "Integration test: Token replenishment"
Task: "Integration test: Independent client limits"
Task: "Integration test: KV failure scenarios"
```

## Clean Architecture Validation Checklist
*GATE: Checked before execution*

- [x] Domain layer has no outward dependencies (framework-agnostic)
- [x] Use case orchestrates domain objects without framework coupling
- [x] Infrastructure implements domain interfaces (dependency inversion)  
- [x] Interface layer only handles HTTP/framework concerns
- [x] All tests written before implementation (TDD compliance)
- [x] Parallel tasks target different files or independent test sections
- [x] Dependencies flow inward (Interface → UseCase → Domain)
- [x] Repository pattern abstracts persistence concerns
- [x] DI container manages object creation and dependencies

## Task Generation Rules Applied
1. **From Data Model**: 3 entities → 3 test tasks + 3 implementation tasks [P]
2. **From Use Case**: 1 use case → 1 test + 1 implementation
3. **From Infrastructure**: 1 repository → 1 test + 1 implementation  
4. **From Interface**: 1 middleware → 1 test + 1 implementation
5. **From Quickstart**: 6 scenarios → 6 integration tests [P]
6. **Clean Architecture**: Inside-out dependency ordering
7. **TDD**: All tests before corresponding implementations

## Notes
- [P] tasks can run concurrently (different files or independent test sections)
- Verify all tests FAIL before implementing (TDD requirement)
- Follow Clean Architecture dependency rules strictly
- Use existing DI patterns for consistency
- Maintain fail-open behavior for KV errors
- Commit after each completed task