import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * Schema for the data the MVP does NOT need (translation is stateless — see
 * /api/translate). This backs v1.5+ features named in the PRD: saved
 * history, team glossary, org/seat management for the Team & Enterprise
 * tiers. Nothing here is wired to a UI yet — see lib/db/client.ts.
 */

export const users = pgTable("users", {
  id: text("id").primaryKey(), // Clerk user id — no separate auth table needed
  email: varchar("email", { length: 255 }).notNull(),
  plan: varchar("plan", { length: 20 }).notNull().default("free"), // free | pro | team | enterprise
  // Pro is sold as a one-time 30-day pass (PayMongo has no hosted checkout
  // for recurring billing — see lib/paymongo.ts), not an auto-renewing
  // subscription. `plan` is display-only; this is what access actually
  // checks. Null/past = not Pro.
  proExpiresAt: timestamp("pro_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  plan: varchar("plan", { length: 20 }).notNull().default("team"), // team | enterprise
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const organizationMembers = pgTable("organization_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull().default("member"), // owner | member
});

// Saved automatically for every signed-in translation (anonymous
// translations are never persisted — no guest cookie ever reaches this
// table). Signing in is the consent boundary, not a separate opt-in
// checkbox; users can delete their own history via DELETE /api/history/[id]
// or DELETE /api/history (clear all), which is the actual GDPR-erasure path.
export const translations = pgTable(
  "translations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceExcerpt: text("source_excerpt").notNull(), // truncated preview, not the full source
    level: varchar("level", { length: 30 }).notNull(),
    tone: varchar("tone", { length: 30 }).notNull(),
    format: varchar("format", { length: 20 }).notNull(),
    outputText: text("output_text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("translations_user_created_idx").on(table.userId, table.createdAt)]
);

// Idempotency guard for PayMongo webhook deliveries — PayMongo retries on
// timeout/5xx, and a replayed/captured signed payload would otherwise stack
// another Pro grant each time it's (re)delivered. See /api/paymongo/webhook.
export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(), // PayMongo event id (event.data.id)
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

// Team-tier shared glossary (PRD §4.2/§4.3) — org-specific term mappings
// applied to keep translation output consistent with internal naming.
export const glossaryTerms = pgTable("glossary_terms", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  term: varchar("term", { length: 255 }).notNull(),
  translation: text("translation").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
