# Implementation Plan: KV Token Bucket Rate Limiting

**Branch**: `002-kv` | **Date**: 2025-09-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-kv/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path ✓
   → Feature spec loaded successfully
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type: web (backend-focused with Cloudflare Workers)
   → Set Structure Decision based on project type
3. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
6. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
8. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Implement minimal token bucket rate limiting middleware using KV storage to protect API endpoints from abuse while allowing reasonable burst traffic. Primary requirement: 10 requests/minute per IP, 100 requests/minute system-wide, with graceful KV failure handling.

## Technical Context
**Language/Version**: TypeScript with Bun runtime, Cloudflare Workers environment  
**Primary Dependencies**: Hono framework, Cloudflare KV, existing middleware stack  
**Storage**: Cloudflare KV for rate limit state persistence  
**Testing**: Bun test framework (existing test structure)  
**Target Platform**: Cloudflare Workers with Bun local development  
**Project Type**: web - existing backend service with middleware architecture  
**Performance Goals**: Sub-10ms middleware execution, minimal memory footprint  
**Constraints**: Cloudflare Workers limits, KV eventual consistency, fail-open requirement  
**Scale/Scope**: Protect existing API endpoints (touring index calculation), minimal code changes

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (existing moto-weather-index service)
- Using framework directly? Yes (Hono middleware integration)
- Single data model? Yes (token bucket state only)
- Avoiding patterns? Yes (no Repository/UoW, direct KV access)

**Architecture**:
- EVERY feature as library? N/A (middleware integration)
- Libraries listed: N/A (single service enhancement)
- CLI per library: N/A (web service)
- Library docs: N/A (middleware component)

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? Yes (tests first for middleware)
- Git commits show tests before implementation? Will be enforced
- Order: Contract→Integration→E2E→Unit strictly followed? Yes
- Real dependencies used? Yes (actual KV in tests)
- Integration tests for: middleware behavior, rate limiting logic
- FORBIDDEN: Implementation before test, skipping RED phase

**Observability**:
- Structured logging included? Yes (existing logging system)
- Frontend logs → backend? N/A (backend only)
- Error context sufficient? Yes (rate limit context)

**Versioning**:
- Version number assigned? N/A (service enhancement)
- BUILD increments on every change? Follows existing CI/CD
- Breaking changes handled? N/A (additive middleware)

## Project Structure

### Documentation (this feature)
```
specs/002-kv/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Clean Architecture compliant structure
src/
├── domain/              # EXISTING: Domain layer
│   └── RateLimit.ts    # NEW: Rate limit domain entities and value objects
├── usecase/             # EXISTING: Use case layer  
│   └── EnforceRateLimit.ts # NEW: Rate limit enforcement use case
├── infra/               # EXISTING: Infrastructure layer
│   └── KVRateLimitRepository.ts # NEW: KV storage adapter
├── interface/           # EXISTING: Interface layer
│   └── middleware/      # EXISTING: Middleware directory
│       └── rateLimitMiddleware.ts # NEW: Hono middleware integration
├── di/                  # EXISTING: Dependency injection
│   └── container.ts     # MODIFY: Add rate limit dependencies
└── worker.ts           # MODIFY: KV binding integration

tests/
├── domain/             # NEW: Domain tests
│   └── RateLimit.test.ts
├── usecase/            # EXISTING: Use case tests  
│   └── EnforceRateLimit.test.ts
├── infra/              # EXISTING: Infrastructure tests
│   └── KVRateLimitRepository.test.ts
├── interface/          # EXISTING: Interface tests
│   └── middleware/
│       └── rateLimitMiddleware.test.ts
└── integration/        # EXISTING: Integration tests
    └── rateLimitIntegration.test.ts
```

**Structure Decision**: Option 1 (Single project) - enhancing existing moto-weather-index service

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - KV best practices for rate limiting in Cloudflare Workers
   - Token bucket implementation patterns for distributed systems
   - Hono middleware integration patterns
   - KV consistency considerations for rate limiting

2. **Generate and dispatch research agents**:
   ```
   Task: "Research Cloudflare KV best practices for rate limiting"
   Task: "Find token bucket algorithm implementations for distributed systems"
   Task: "Research Hono middleware patterns and integration"
   Task: "Analyze existing codebase middleware structure"
   ```

3. **Consolidate findings** in `research.md`

**Output**: research.md with technical approach decisions

## Phase 1: Design & Contracts (Clean Architecture)
*Prerequisites: research.md complete*

1. **Design Domain Layer** → `data-model.md`:
   - TokenBucket entity: business rules, invariants, state transitions
   - RateLimitPolicy value object: immutable configuration
   - ClientIdentity value object: IP normalization and hashing
   - RateLimitRepository interface: dependency inversion principle

2. **Design Use Case Layer**:
   - EnforceRateLimitUseCase: orchestrate domain objects and repository
   - RateLimitResult: use case output structure
   - Business rule enforcement and error handling

3. **Design Infrastructure Layer**:
   - KVRateLimitRepository: concrete implementation of repository
   - TokenBucketState: persistence data structure
   - KV failure handling with fail-open behavior

4. **Design Interface Layer**:
   - Rate limit middleware: Hono integration
   - HTTP error response formatting
   - IP extraction from request headers

5. **Design Dependency Injection**:
   - Factory functions following existing DI pattern
   - Repository and use case creation
   - Middleware factory with proper dependencies

6. **Generate Clean Architecture contracts**:
   - Layer-specific interfaces and abstractions
   - Testing contracts for each layer
   - Mock interfaces for unit testing

7. **Update CLAUDE.md incrementally**:
   - Clean Architecture structure documentation
   - Testing strategy per layer
   - DI configuration patterns

**Output**: data-model.md, /contracts/*, quickstart.md, CLAUDE.md updates

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy (Clean Architecture TDD)**:
- Load `/templates/tasks-template.md` as base
- Generate tasks following Clean Architecture layers inside-out
- Domain layer tasks: Entity and Value Object tests → implementations [P]
- Use Case layer tasks: Use case tests → implementations [P]
- Infrastructure layer tasks: Repository tests → implementations [P]
- Interface layer tasks: Middleware tests → implementations
- Integration tasks: Full stack behavior validation
- DI configuration tasks: Factory function tests → implementations

**Ordering Strategy (Clean Architecture + TDD)**:
1. Domain layer (innermost): Tests → Implementations [P]
2. Use Case layer: Tests → Implementations [P]  
3. Infrastructure layer: Tests → Implementations [P]
4. Interface layer: Tests → Implementations
5. DI configuration: Tests → Factory functions
6. Integration tests: End-to-end validation
7. Environment setup: KV bindings, TypeScript types

**Estimated Output**: 18-22 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*No constitutional violations - minimal middleware implementation*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None      | N/A        | N/A                                |

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none required)

---
*Based on Constitution v2.1.1*