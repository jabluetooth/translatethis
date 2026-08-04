# TranslateThis
**Technical in. Plain English out.**
Product Requirements Document · v1.1 (renamed from *PlainSpeak AI* v1.0)
Status: Draft · Audience: Internal

> Renamed per stakeholder direction from **PlainSpeak AI** to **TranslateThis** (Direction 2 candidate in the original naming exercise). See Audit Finding 1 before locking this in publicly — there is a live naming collision.

---

## 0. Audit summary (v1.0 → v1.1)

A full read of the original PRD surfaced eight issues worth resolving before build starts. Ranked by severity:

| # | Finding | Severity | Recommendation |
|---|---|---|---|
| 1 | **Name collision.** An app called *"TranslateThis – AI Translator"* already ships on the App Store — a voice/text/camera literal-language translator (140+ languages). Same name, adjacent category. Users searching "TranslateThis" will land on a competitor's literal-translation app, not this jargon-translation tool. This also undercuts the SEO goal in §7.1 ("rank top 3 for 'technical jargon translator'") since the bare name won't disambiguate. The original PRD's own recommendation (§ App name candidates) was *PlainSpeak AI* or *Decode*, not TranslateThis — this rename knowingly overrides that. | High | Ship with a disambiguating tagline/suffix everywhere the name appears standalone — e.g. "TranslateThis for Teams" or domain `translatethis.dev` — and check trademark clearance before public launch. Proceeding per instruction, flagged here for visibility. |
| 2 | **Feature gap: no file input in MVP scope.** v1.0 §4.1 only specifies freeform text paste (≤5,000 chars). The requested UX — "drag a file, or type text" — needs file upload as a first-class MVP feature, not a v1.5 add-on. Added below (§4.1). | High | Added drag-and-drop file input to MVP scope with explicit format/size limits. |
| 3 | **Privacy/storage contradiction.** §6 NFRs state *"no user input stored server-side without explicit opt-in,"* but file upload widens the exposure surface (temp storage, virus/malware scanning, memory retention during LLM calls) beyond what a pasted-text flow implies. Not addressed in v1.0. | High | Explicit statement added: uploaded files are parsed to text in-memory, discarded immediately after translation, never written to disk or object storage unless the user opts into history (v1.5+). |
| 4 | **Anonymous-use vs. signup-wall tension.** The stated UX — "anyone can drag a file... and a button to translate" — implies zero-friction, no-login use. But §8 pricing gates the Free tier at "20 translations/month," which requires an account to enforce. Not reconciled in v1.0. | Medium | Recommend a metered anonymous mode (IP/session-limited, e.g. 3 translations before signup prompt) rather than a hard login wall — matches the low-friction UX the stakeholder described while still bounding LLM cost exposure. |
| 5 | **Revenue math doesn't bridge.** 10,000 MAU × 8% conversion × $12/mo Pro ≈ $9,600 MRR — nowhere near the $100k Month-12 MRR target (§7.3). The gap has to come from Team/Enterprise tiers, but no unit-economics model ties MAU → paid mix → MRR. | Medium | Not fixed in this pass (business-model decision, not a naming/tech question) — flagging so it's not silently load-bearing on an unvalidated assumption. |
| 6 | **Prompt-surface complexity for an MVP.** 3 jargon levels × 4 tones × 3 output formats = 36 combinations to prompt-engineer and QA before launch. Large for a 4-week build window (§11, Phase 0). | Medium | Recommend trimming launch scope to 3 tones (drop one, e.g. merge Reassuring into Professional-with-context) or explicitly budget QA time per combination. |
| 7 | **Model reference had a copy error.** v1.0 §4.1/§10 lists "Claude claude-sonnet-4-6" / "Anthropic claude-sonnet-4-6 (claude-sonnet-4-6)" — vendor and model name duplicated/garbled. | Low | Corrected to "Anthropic Claude (claude-sonnet-4-6)" throughout. |
| 8 | **Literal-translation confusion risk compounds Finding 1.** §6 NFRs already plan UI localisation to 5 languages by v2.0. Combined with the generic name, users may expect this tool to translate *spoken languages*, not jargon-to-plain-English. | Medium | Recommend the product surface (not just marketing) always pairs "TranslateThis" with a qualifier — e.g. header reads "TranslateThis — turn technical writing into plain English," never the bare name alone. |

---

## 1. Executive summary

Technical professionals spend an estimated 20–30% of communication time translating engineering language for non-technical stakeholders — a process that is repetitive, context-blind, and often done badly under pressure (e.g. during active incidents). **TranslateThis** eliminates this friction by applying large language models to produce audience-appropriate translations of technical content in seconds, with controls for jargon level and tone.

The product targets individual engineers and engineering teams at technology companies, with a growth path into platform integrations (Slack, Jira, PagerDuty, Linear) and enterprise deals.

| Metric | Target (12 months) |
|---|---|
| Monthly active users | 10,000 MAU |
| Paid conversion | 8% of free users |
| NPS | > 50 |
| Average weekly sessions per user | 5+ |
| Enterprise accounts (10+ seats) | 25 |

## 2. Problem statement

### 2.1 The core pain
Engineering teams produce a constant stream of technical artefacts — post-mortems, PR descriptions, incident timelines, architecture decision records, sprint retrospectives — that contain critical information non-technical stakeholders (executives, PMs, customers, legal, finance) need to act on. The translation between these two modes of communication is painful in three ways:
- **Speed:** During an active incident, engineers can't stop to write a board-ready status update.
- **Quality:** The translation is often either too technical (loses the audience) or dumbed down to the point of losing key facts.
- **Tone:** Engineers default to neutral, factual language. Stakeholders need reassurance, urgency, or business framing depending on the situation.

### 2.2 Research findings
- Stack Overflow Developer Survey (2023): 58% of developers cite "communicating with non-technical stakeholders" as a significant pain point.
- Google's Project Aristotle: communication overhead is the #1 cited drag on engineering productivity for teams > 20 people.
- Incident.io State of Incidents (2023): average time from incident resolution to stakeholder communication is 4.3 hours — largely due to translation effort.
- Gartner (2022): poor IT communication costs enterprises an average of $62.4M/year in delayed decisions and misaligned expectations.

### 2.3 Current alternatives and why they fail
| Alternative | Why it fails |
|---|---|
| Writing it manually | Slow, inconsistent, requires context-switching mid-incident |
| Asking a PM or manager to translate | Creates bottleneck, PM lacks technical depth |
| Generic ChatGPT prompt | No jargon tuning, no tone control, no format templates, no integrations |
| Documentation tools (Notion AI) | Not purpose-built for technical↔business translation, no incident templates |
| Communication trainings | Addresses skill, not the in-the-moment need |

## 3. Solution overview

TranslateThis is a web application (with Slack and API integrations planned) that accepts raw technical content — pasted text **or an uploaded file** — and returns stakeholder-ready translations. The core interaction is: **provide input (paste or drag a file) → select jargon level and tone → click Translate → get output.** The product is designed to feel instant — a tool engineers reach for reflexively, not reluctantly, with no login required for the first few uses.

### 3.1 Core concept
| Input (from engineer) | Output (for stakeholder) |
|---|---|
| P0 incident post-mortem with stack traces | Board-level incident summary with business impact |
| PR description with technical implementation detail | Non-technical changelog entry for a release email |
| Architecture decision record (ADR) | Executive summary of why a tech decision was made |
| Sprint retrospective with jargon | Manager-friendly team health summary |
| CVE / security patch notes | Risk communication for legal and compliance |

## 4. Feature requirements

### 4.1 MVP features (v1.0)

**CORE TRANSLATION ENGINE**
- Accepts freeform text input (up to 5,000 characters)
- **Accepts drag-and-drop or click-to-browse file upload** as an alternative to pasted text *(added in this revision — was missing from v1.0 scope despite being core to the intended UX)*
  - Supported formats: `.txt`, `.md`, `.log`, `.pdf`, `.docx`
  - Max file size: 2 MB (generous for text-based incident/PR content; keeps parsing fast and cost-bounded)
  - File is parsed to plain text in-memory server-side and **discarded immediately after the translation completes** — never written to disk or object storage by default, consistent with the no-server-storage NFR (§6)
  - Malformed/unparseable files fail with a clear inline error, not a silent empty translation
- Three jargon output levels: Board-ready, Manager-friendly, Semi-technical
- Four tone modes: Professional, Casual, Reassuring, Urgent *(see Audit Finding 6 — consider trimming to 3 for MVP QA scope)*
- Output is copy-to-clipboard ready, formatted for email or Slack
- Translation powered by **Groq (openai/gpt-oss-120b)** via the Groq API *(switched from Anthropic Claude — see §10)*

**INPUT EXPERIENCE**
- Example prompt library (6 pre-loaded scenarios: incident, migration, PR, CVE, ADR, sprint retro)
- Character count indicator
- Paste-from-clipboard shortcut
- Drag-and-drop zone with visible affordance (dashed border, hover state) and a "browse files" fallback for accessibility
- Input auto-detection: hints at detected content type (e.g. "Looks like an incident report")

**OUTPUT EXPERIENCE**
- Copy button with confirmation state
- "Regenerate" for alternate phrasing
- Output format toggle: paragraph / bullet summary / email-ready with subject line
- Reading level indicator (Flesch-Kincaid score displayed on output)

**ACCESS MODEL** *(added in this revision — see Audit Finding 4)*
- No login required for first 3 translations per session (IP/cookie-bounded), to match the "anyone can just show up and translate" UX intent
- Signup prompt appears after the free-anonymous quota is used, gating the full 20/month Free tier

### 4.2 V1.5 features (post-MVP)
- Saved translation history (last 30 translations, local storage first)
- Custom output templates (org-specific formats for RCAs, release notes, etc.)
- Side-by-side comparison: view original vs. translated in split pane
- Team glossary: define internal terms/acronyms that should be translated consistently
- Slack integration: `/translatethis` slash command

### 4.3 V2.0 features (growth)
- Jira / Linear integration: auto-translate ticket descriptions on close
- PagerDuty integration: auto-generate stakeholder update from incident timeline
- API access for enterprise self-hosting and CI/CD pipeline integration
- Multi-language output (translate to stakeholder language AND target audience) — *note: coordinate messaging carefully here given Audit Finding 8*
- Analytics dashboard: translation volume, most used tones, avg output reading level

## 5. User stories

| As a… | I want to… | So that… | Priority |
|---|---|---|---|
| On-call engineer | Translate my incident timeline in < 30 seconds | I can send a stakeholder update during an active P1 without losing focus | P0 |
| Engineering manager | Paste a sprint retro and get an exec summary | I can share team health without writing two versions of the same thing | P0 |
| Senior engineer | Control the jargon level of my PR announcement | Product managers and marketing understand what shipped | P1 |
| Security engineer | Reframe a CVE advisory for legal and compliance | Non-technical teams understand risk without being alarmed by jargon | P1 |
| CTO | Generate a board-ready summary of an ADR | I can communicate architecture decisions without a separate slide deck | P1 |
| DevRel / tech writer | Batch-translate release notes for multiple audiences | I publish one changelog that works for devs and non-devs | P2 |
| Enterprise team | Use a shared glossary of internal terms | Translation output is consistent with our org's naming conventions | P2 |

## 6. Non-functional requirements

| Category | Requirement |
|---|---|
| Performance | P50 translation latency < 2s; P95 < 5s |
| Availability | 99.5% uptime SLA for paid tiers |
| Security | No user input (text or file) stored server-side without explicit opt-in; uploaded files parsed in-memory and discarded post-translation; SOC 2 Type II roadmap |
| Privacy | GDPR compliant; user data never used for model training without consent |
| Accessibility | WCAG 2.2 AA compliant; keyboard-navigable; screen reader tested; file upload has a non-drag fallback |
| Scalability | Handle 1,000 concurrent translations without degradation |
| Mobile | Fully functional on mobile browsers (iOS Safari, Chrome Android), including file upload via native file picker |
| Internationalisation | UI localised to EN, DE, FR, ES, JP by v2.0 |

## 7. Success metrics

*(unchanged from v1.0 — see Audit Finding 5 on unmodeled revenue bridge)*

### 7.1 Acquisition
- Website visits → free sign-ups: target 15% conversion
- Viral coefficient: 1 user invites 0.3 colleagues within 14 days (driven by share/copy flows)
- SEO: rank top 3 for "technical jargon translator", "post-mortem generator", "incident summary tool"

### 7.2 Engagement
- D7 retention: 40% of users translate again within 7 days of signup
- Session depth: average 3+ translations per session
- Feature adoption: 60% of users try at least 2 different tone modes within first week

### 7.3 Revenue
- Free → Pro conversion: 8% within 30 days
- Annual contract value (ACV) for enterprise: $4,800–$24,000
- Month-6 MRR target: $25,000
- Month-12 MRR target: $100,000

## 8. Pricing model

| Tier | Price | Limits | Target |
|---|---|---|---|
| Free (anonymous) | $0, no signup | 3 translations/session | First-touch, viral loop |
| Free (account) | $0/month | 20 translations/month, 3 tone modes, no history | Individual engineers, trial |
| Pro | $12/month | Unlimited translations, all tones, 90-day history, templates | Power users, indie devs |
| Team | $49/month (up to 10 seats) | Everything in Pro + shared glossary, team analytics, Slack integration | Eng teams, startups |
| Enterprise | Custom | SSO, API access, custom templates, SLA, dedicated support, on-prem option | Orgs 100+ engineers |

*(Free tier split into anonymous vs. account-based added in this revision — see Audit Finding 4.)*

## 9. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LLM output quality varies; translation embarrasses user in front of stakeholder | Medium | High | Always-editable output, regenerate button, reading level score so user can validate quality |
| Sensitive incident data (text or uploaded file) posted to third-party API | Medium | High | Clear privacy policy; enterprise on-prem option; no server-side storage by default; files never persisted |
| **Name collision with existing "TranslateThis" translation app dilutes brand/SEO** *(new)* | High | Medium | Disambiguating tagline everywhere; consider a qualified domain/handle; legal trademark check before public launch |
| Groq API costs or capacity limits make free tier unsustainable | Low | Medium | Caching common patterns; rate-limiting free tier (including anonymous quota); prompt compression |
| Large incumbent (Notion, Atlassian) adds similar feature | Medium | High | Depth of specialisation (templates, integrations, glossary) that generic tools won't prioritise |
| User adoption stalls because engineers resist new tools | Low | Medium | CLI tool and Slack slash command reduce friction; integrations meet engineers where they work |

## 10. Recommended tech stack (revised)

The original stack (Next.js, Node/Fastify split backend, Clerk, Supabase Postgres, Stripe, Vercel+Railway, Sentry+PostHog) was directionally sound. Revised below specifically for the confirmed MVP interaction — **drag a file or type text, pick a level/tone, hit Translate** — with an eye to shipping in a 4-week window (§11) with minimal ops surface.

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | **Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui (Radix primitives)** | SSR for SEO; Radix-based components give WCAG 2.2 AA accessibility largely for free, which is a hard NFR (§6) |
| File upload UX | **react-dropzone** | Purpose-built drag-and-drop with keyboard/click fallback, satisfies the accessibility requirement for a non-drag path |
| File parsing | **`pdf-parse` (PDF), `mammoth` (.docx→text), native read (.txt/.md/.log)** | Lightweight, in-memory extraction — no persistence needed, matches the no-storage NFR |
| Backend/API | **Next.js Route Handlers, not a separate Fastify service** | For a text-in/text-out MVP, a second backend service is unneeded ops overhead; Next.js API routes + streaming cover P50 < 2s / P95 < 5s comfortably. Revisit a standalone service only when background jobs (Jira/PagerDuty integrations, v2.0) require it |
| AI integration | **Groq API (openai/gpt-oss-120b) via the Vercel AI SDK**, streamed to the client | Stakeholder decision (2026-08-04): moved off Anthropic to Groq for inference speed/cost. AI SDK's provider abstraction made this a same-shape swap (`createAnthropic` → `createGroq`, one file). Streaming still keeps perceived latency low; model id is env-configurable since Groq's catalog turns over (see deprecations at console.groq.com/docs/deprecations) |
| Auth | **Clerk** | Fast to ship, built-in SSO path for the Enterprise tier later; must support an anonymous/guest session (Clerk's session tokens or a signed cookie) to satisfy the no-login-first-use requirement |
| Anonymous rate limiting | **Upstash Redis + `@upstash/ratelimit`** | Cheap, serverless-friendly IP/session-based quota for the pre-signup free tier (Audit Finding 4) |
| Database | **PostgreSQL via Supabase** (unchanged) | Relational fit for user/history/glossary data; Supabase bundles auth-adjacent tooling and storage if v1.5 history needs it |
| File storage (v1.5+, optional) | **Vercel Blob or S3 with short TTL** | Only if/when users opt into saved history that references originals; not needed for MVP given in-memory-only processing |
| Payments | **Stripe** (unchanged) | Proven usage-based + subscription billing fit for the tiered pricing model |
| Deployment | **Vercel only** (frontend + API routes unified) | Original PRD split Vercel/Railway; unnecessary for an MVP with no long-running backend process — cuts an entire deploy target and its ops burden |
| Monitoring | **Sentry (errors) + PostHog (product analytics)** (unchanged) | Good pairing; PostHog also covers the tone/level feature-adoption metrics in §7.2 |
| Accessibility testing | **axe-core in CI (via `@axe-core/playwright`)** *(new)* | Automates a slice of the WCAG 2.2 AA requirement so it isn't only caught manually at the end |

**Why this over alternatives:** a Python/FastAPI backend was considered and rejected — no ML training or heavy numerical work is happening server-side (translation is a hosted-API call), so there's no Python-specific advantage, and it would fragment the stack into two languages for no benefit. A fully client-side/serverless-functions-only approach (no framework) was also considered and rejected — Next.js's SSR is directly useful for the stated SEO acquisition goal (§7.1), which a pure SPA would forfeit.

## 11. Go-to-market roadmap

*(unchanged from v1.0)*

| Phase | Timeline | Goal | Key actions |
|---|---|---|---|
| 0 — Build | Weeks 1–4 | Working MVP | Core translation UI, 3 jargon levels, 4 tones, example library, copy flow, file upload |
| 1 — Seed | Weeks 5–8 | 500 beta users | Launch on Product Hunt, post to Hacker News, dev Twitter/X, Reddit r/devops |
| 2 — Grow | Weeks 9–16 | 2,000 MAU | Slack integration, history, templates; content marketing (SEO blog on incident comms) |
| 3 — Monetise | Month 5–6 | First 100 paid users | Launch Pro tier, in-app upgrade prompts at limit, outbound to mid-size eng teams |
| 4 — Scale | Month 7–12 | 10,000 MAU, $100k MRR | Enterprise tier, API, Jira/PagerDuty integrations, team glossary, first sales hire |

## 12. Appendix — example translation pairs

**Example A — P0 Incident**
INPUT (engineer): *P0 — auth service OOM-killed by Redis pub/sub race condition. 47-min downtime. 3,200 affected users. Fixed via mutex locking + memory limit increase.*
- **Board-ready:** A software reliability issue caused our login service to be unavailable for 47 minutes, affecting approximately 3,200 customers. Our engineering team identified and resolved the root cause. Preventive measures are now in place to stop recurrence.
- **Manager-friendly:** A memory management bug in our authentication infrastructure caused a 47-minute service outage for 3,200 users. The issue was in how our messaging system handled concurrent requests. It's been patched and we've increased resource limits as a safeguard.
- **Semi-technical:** A race condition in our Redis pub/sub event handler caused unbounded memory growth, triggering an OOM kill on the auth service pod. 47-minute outage for 3,200 users. Resolved with mutex locking and pod memory limit increases.

**Example B — Security CVE**
INPUT (engineer): *Patching CVE-2024-1234 in jsonwebtoken (CVSS 9.1 Critical). Algorithm confusion attack allows JWT forgery via HS256 with public RSA key as HMAC secret. Upgrading to v9.0.0 + whitelist RS256 only.*
- **Board-ready:** We identified and patched a critical security vulnerability in our authentication system. If left unaddressed, it could have allowed unauthorised access to user accounts. The patch has been deployed with no user-facing disruption.
- **Manager-friendly:** We patched a critical-rated security flaw (CVE-2024-1234) in the library we use to manage login tokens. The vulnerability could have allowed an attacker to forge valid user sessions. Fixed by upgrading the library and restricting allowed authentication methods.

— END OF DOCUMENT —
