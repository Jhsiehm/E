# 0004. Typed API client now; generated contracts from P1

Date: 2026-11-12 · Status: accepted (P0)

## Context
03_API_CONTRACTS.md requires OpenAPI generated from the implementation's
validators and a matching typed client. No `/api/v1` endpoint exists yet, so
there is nothing to generate from.

## Decision
- `lib/contracts/api.ts` holds the common wire conventions by hand: error
  envelope and codes, list/detail wrappers, page sizes, membership roles,
  capabilities, `Me` and `MePatch` (no role field, so job title cannot grant
  access).
- `lib/api/client.ts` implements the conventions: v1 and legacy error parsing,
  refusing non-JSON bodies, safe retries (GET/HEAD/OPTIONS or Idempotency-Key;
  429/502/503 and network errors; Retry-After honoured and capped;
  `service_not_configured` and 401 never retried), `If-Match`, `X-Workspace-Id`,
  cursor pagination with repeated-cursor protection. No body logging.
- From P1, request/response schemas are written with Zod in the BFF, OpenAPI is
  emitted from them, and `lib/contracts` types are generated; a CI check fails
  when the generated file is stale.

## Consequences
The client and its tests are stable now; only the type source changes in P1.
