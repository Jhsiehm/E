/**
 * Wire contracts shared by the BFF and the browser client
 * (docs/handoff/03_API_CONTRACTS.md, "Common wire conventions").
 *
 * Hand-written in P0. Once the first /api/v1 endpoints exist (P1) these are
 * generated from the OpenAPI document produced by the request validators; see
 * docs/decisions/0004-api-contracts.md.
 */

export const API_V1_PREFIX = "/api/v1";

export const ERROR_CODES = [
  "bad_request",
  "unauthenticated",
  "forbidden",
  "not_found",
  "conflict",
  "payload_too_large",
  "unsupported_media_type",
  "validation_failed",
  "invalid_cursor",
  "rate_limited",
  "provider_error",
  "service_unavailable",
  "service_not_configured",
  // client-side only: network failure or a response that was not the API's JSON
  "network_error",
  "unexpected_response",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** Status -> default code, used when a body has no recognised code. */
export const STATUS_CODES: Record<number, ErrorCode> = {
  400: "bad_request",
  401: "unauthenticated",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  413: "payload_too_large",
  415: "unsupported_media_type",
  422: "validation_failed",
  429: "rate_limited",
  502: "provider_error",
  503: "service_unavailable",
};

export interface ErrorBody {
  error: {
    code: ErrorCode | string;
    message: string;
    requestId: string;
    fieldErrors?: Record<string, string[]>;
  };
}

export interface ListResponse<T> {
  items: T[];
  nextCursor: string | null;
  totalEstimate: number | null;
}

export interface DetailResponse<T> {
  data: T;
  requestId: string;
}

export const PAGE_SIZE_DEFAULT = 25;
export const PAGE_SIZE_MAX = 100;

/** Methods the client may retry automatically without an Idempotency-Key. */
export const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"] as const;

/** Membership roles (02 §Physical schema). Job title is a separate free-text field. */
export const MEMBERSHIP_ROLES = [
  "owner",
  "admin",
  "attorney",
  "paralegal",
  "viewer",
] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const CAPABILITIES = [
  "matter.read",
  "matter.write",
  "matter.share",
  "matter.review",
  "document.read",
  "document.upload",
  "document.export",
  "document.delete",
  "research.run",
  "research.view",
  "authority.save",
  "impact.review",
  "agent.assign",
  "agent.configure",
  "settings.manage",
  "audit.export",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

/** GET /me (03 §Identity/workspaces). */
export interface Me {
  id: string;
  displayName: string;
  emailVerified: boolean;
  jobTitle: string | null;
  timeZone: string;
  defaultPracticeArea: string | null;
  workspaces: {
    id: string;
    name: string;
    role: MembershipRole;
    capabilities: Capability[];
  }[];
}

/** Fields PATCH /me accepts. Deliberately has no role/membership field. */
export type MePatch = Partial<
  Pick<Me, "displayName" | "jobTitle" | "timeZone" | "defaultPracticeArea"> & {
    theme: string;
  }
>;
