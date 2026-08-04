CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "translations_user_created_idx" ON "translations" USING btree ("user_id","created_at");