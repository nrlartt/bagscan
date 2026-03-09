# Roadmap: BagScan v1.1 Reliability and Launch Integrity

## Overview

This roadmap upgrades BagScan from "feature working in most cases" to "launch path trusted in production." Work starts with visibility and error contracts, then fixes image durability, then enforces BagScan-only deploy feed correctness, then hardens idempotent multi-step launch behavior, and finally adds operational safeguards.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Launch Observability and Error Contracts** - Make launch failures diagnosable and user-facing errors actionable.
- [ ] **Phase 2: Durable Image Upload and Metadata Wiring** - Ensure uploaded token images persist and propagate correctly to launch metadata.
- [ ] **Phase 3: BagScan-Only Recent Deploy Feed** - Enforce strict feed filtering so recent deploys reflect only BagScan-origin launches.
- [ ] **Phase 4: Launch Retry Safety and Flow Hardening** - Add safe retries and idempotent orchestration across multi-step launch.
- [ ] **Phase 5: Endpoint Guardrails and Throughput Safety** - Protect high-cost routes with throttling and operational controls.

## Phase Details

### Phase 1: Launch Observability and Error Contracts
**Goal**: Launch failures become diagnosable for both users and maintainers with consistent error handling.
**Depends on**: Nothing (first phase)
**Requirements**: [LCH-01, LCH-02, OPS-01]
**Success Criteria** (what must be TRUE):
  1. User receives clear failure reason and launch-step context instead of generic unknown errors.
  2. Bags API transient 5xx responses are retried with bounded backoff before failure is returned.
  3. Logs include correlation id and upstream status for each launch step.
**Plans**: 3 plans

Plans:
- [ ] 01-01: Normalize launch error model and response payloads across launch API routes.
- [ ] 01-02: Add retry/backoff wrapper for transient upstream failures.
- [ ] 01-03: Add structured launch logging with request and correlation identifiers.

### Phase 2: Durable Image Upload and Metadata Wiring
**Goal**: User-uploaded images become stable metadata assets for launched tokens.
**Depends on**: Phase 1
**Requirements**: [IMG-01, IMG-02, IMG-03, IMG-04]
**Success Criteria** (what must be TRUE):
  1. Uploaded images persist to durable URL and remain accessible after launch completes.
  2. Launch metadata payload references persisted image URL rather than temporary path.
  3. Upload failures can be retried without clearing previously entered form data.
**Plans**: 3 plans

Plans:
- [ ] 02-01: Refactor upload API for durable storage path strategy and URL validation.
- [ ] 02-02: Wire persisted image URL into launch metadata creation payload.
- [ ] 02-03: Improve launch form validation/retry UX for image handling.

### Phase 3: BagScan-Only Recent Deploy Feed
**Goal**: `RECENT BAGSCAN DEPLOYS` accurately reflects only BagScan deploy-tool launches.
**Depends on**: Phase 2
**Requirements**: [DPL-01, DPL-02, DPL-03, DPL-04, OPS-03]
**Success Criteria** (what must be TRUE):
  1. Feed excludes launches that do not originate from BagScan deploy context.
  2. Feed entries include canonical launch metadata (mint, symbol/name, launcher, timestamp).
  3. Feed output order and pagination remain deterministic between calls.
**Plans**: 3 plans

Plans:
- [ ] 03-01: Define and enforce BagScan-origin criteria at storage/query layer.
- [ ] 03-02: Refactor feed query/mapper to return only validated BagScan launch records.
- [ ] 03-03: Add tests for partner-only filtering and feed pagination ordering.

### Phase 4: Launch Retry Safety and Flow Hardening
**Goal**: Users can retry launch flow safely without duplicate or partial inconsistent launches.
**Depends on**: Phase 3
**Requirements**: [LCH-03, LCH-04, OPS-02]
**Success Criteria** (what must be TRUE):
  1. Retrying a failed step does not create duplicate launch intents or inconsistent state.
  2. Fee-share and launch transaction steps support bounded resume/retry behavior.
  3. Launch API tests cover happy path plus key recoverable and non-recoverable failures.
**Plans**: 2 plans

Plans:
- [ ] 04-01: Add idempotency guards and launch-step state transitions.
- [ ] 04-02: Implement launch API integration tests for retry and failure scenarios.

### Phase 5: Endpoint Guardrails and Throughput Safety
**Goal**: Public high-cost endpoints are protected against abusive traffic and quota exhaustion.
**Depends on**: Phase 4
**Requirements**: [OPS-04]
**Success Criteria** (what must be TRUE):
  1. High-cost routes enforce basic rate limiting/throttling policy.
  2. Exceeded limits return explicit and client-handleable responses.
  3. Guardrail behavior is documented and verified in endpoint tests.
**Plans**: 2 plans

Plans:
- [ ] 05-01: Introduce reusable route-level throttling middleware/util.
- [ ] 05-02: Apply and test throttling on launch and token feed endpoints.

## Progress

**Execution Order:**
Phases execute in numeric order: 2 → 2.1 → 2.2 → 3 → 3.1 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Launch Observability and Error Contracts | 0/3 | Not started | - |
| 2. Durable Image Upload and Metadata Wiring | 0/3 | Not started | - |
| 3. BagScan-Only Recent Deploy Feed | 0/3 | Not started | - |
| 4. Launch Retry Safety and Flow Hardening | 0/2 | Not started | - |
| 5. Endpoint Guardrails and Throughput Safety | 0/2 | Not started | - |
