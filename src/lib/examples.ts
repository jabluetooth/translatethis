export interface ExamplePrompt {
  id: string;
  label: string;
  text: string;
}

export const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  {
    id: "incident",
    label: "P0 incident",
    text: "P0 — auth service OOM-killed by Redis pub/sub race condition. 47-min downtime. 3,200 affected users. Fixed via mutex locking + memory limit increase.",
  },
  {
    id: "migration",
    label: "Database migration",
    text: "Migrated primary datastore from MongoDB 4.2 to 6.0 across 3 shards. Required dual-write shim for 2 weeks, backfilled 40M documents, cut over with 90s read-only window. Zero data loss, one rollback rehearsal.",
  },
  {
    id: "pr",
    label: "PR description",
    text: "Refactored the checkout service to use optimistic concurrency control instead of row-level locks on the `orders` table. Reduces P99 checkout latency from 800ms to 140ms under load. Adds a `version` column and retry-on-conflict logic in the write path.",
  },
  {
    id: "cve",
    label: "Security CVE",
    text: "Patching CVE-2024-1234 in jsonwebtoken (CVSS 9.1 Critical). Algorithm confusion attack allows JWT forgery via HS256 with public RSA key as HMAC secret. Upgrading to v9.0.0 + whitelist RS256 only.",
  },
  {
    id: "adr",
    label: "Architecture decision",
    text: "ADR-014: Adopt event sourcing for the billing ledger instead of mutable row updates. Rationale: need immutable audit trail for SOC 2, and current update-in-place model has caused 3 reconciliation incidents this year. Tradeoff: higher storage cost, added query complexity via projections.",
  },
  {
    id: "retro",
    label: "Sprint retro",
    text: "Sprint velocity dropped 30% this cycle due to on-call load from the payments incident and unplanned work migrating off the deprecated notifications queue. Two stories carried over. Team flagged tech debt in the reporting service as a recurring blocker.",
  },
];
