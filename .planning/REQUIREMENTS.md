# Requirements: BagScan v1.1 Reliability and Launch Integrity

**Defined:** 2026-03-09
**Core Value:** Launching a token through BagScan should be reliable and should produce correct, verifiable launch data.

## v1 Requirements

### Launch Flow

- [ ] **LCH-01**: User can submit launch metadata with automatic retry/backoff for transient Bags API 5xx responses.
- [ ] **LCH-02**: User sees actionable failure details that identify the failed launch step and error category.
- [ ] **LCH-03**: User can safely retry launch submission without creating duplicate launch attempts.
- [ ] **LCH-04**: User can retry failed fee-share or launch sub-steps without re-entering full launch form data.

### Deploy Feed Integrity

- [ ] **DPL-01**: `RECENT BAGSCAN DEPLOYS` shows only tokens launched through BagScan deploy flow.
- [ ] **DPL-02**: Each deploy feed entry shows mint, token identity, launcher wallet, and launch timestamp from BagScan launch records.
- [ ] **DPL-03**: Feed excludes generic Bags launches not associated with BagScan partner/deploy context.
- [ ] **DPL-04**: Feed API returns deterministic descending sort by launch time with stable pagination.

### Image and Metadata

- [ ] **IMG-01**: User-uploaded launch image is stored in a durable, publicly resolvable URL.
- [ ] **IMG-02**: Persisted image URL is embedded into the metadata payload used for token launch.
- [ ] **IMG-03**: Launch UI validates image MIME type/size before upload and reports validation errors clearly.
- [ ] **IMG-04**: If upload fails, user can retry upload while preserving non-image form fields.

### Operations and Quality

- [ ] **OPS-01**: Launch-related server logs include correlation identifiers and upstream response status per step.
- [ ] **OPS-02**: Automated tests cover launch API success path and common transient/permanent failure paths.
- [ ] **OPS-03**: Automated tests verify BagScan-only deploy filtering logic and reject non-BagScan launch records.
- [ ] **OPS-04**: High-cost public endpoints have rate limiting or throttling safeguards.

## v2 Requirements

### Security Hardening

- **SEC-01**: Partner/admin routes use signed wallet challenge or session-based auth instead of shared secret.
- **SEC-02**: Admin access includes audit trail for claims and configuration actions.

### Platform Resilience

- **PLT-01**: Shared distributed cache replaces in-memory process-local caches for multi-instance consistency.
- **PLT-02**: Background snapshot jobs improve chart continuity without read-triggered updates.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-chain launch orchestration | Would expand core scope beyond Solana/Bags reliability target |
| New tokenomics/launch mode products | Not required to fix current launch correctness issues |
| Full partner authentication redesign | Deferred to v2 security hardening |
| Dedicated mobile app | Web platform remains primary delivery surface |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| LCH-01 | Phase 1 | Pending |
| LCH-02 | Phase 1 | Pending |
| OPS-01 | Phase 1 | Pending |
| IMG-01 | Phase 2 | Pending |
| IMG-02 | Phase 2 | Pending |
| IMG-03 | Phase 2 | Pending |
| IMG-04 | Phase 2 | Pending |
| DPL-01 | Phase 3 | Pending |
| DPL-02 | Phase 3 | Pending |
| DPL-03 | Phase 3 | Pending |
| DPL-04 | Phase 3 | Pending |
| OPS-03 | Phase 3 | Pending |
| LCH-03 | Phase 4 | Pending |
| LCH-04 | Phase 4 | Pending |
| OPS-02 | Phase 4 | Pending |
| OPS-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-09*
*Last updated: 2026-03-09 after roadmap creation*
