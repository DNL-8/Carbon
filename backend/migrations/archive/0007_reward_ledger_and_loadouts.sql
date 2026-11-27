CREATE TABLE "fitness_progress_ledger" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "fitness_progress_ledger_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"xp_delta" integer NOT NULL,
	"coin_delta" integer NOT NULL,
	"total_xp" integer NOT NULL,
	"gold_coins" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fitness_arsenal" ADD COLUMN "loadouts" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "fitness_progress_ledger" ADD CONSTRAINT "fitness_progress_ledger_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fitness_ledger_owner_recent_idx" ON "fitness_progress_ledger" USING btree ("user_id","id" DESC NULLS LAST);
--> statement-breakpoint
INSERT INTO "fitness_progress_ledger"
  ("user_id", "kind", "title", "xp_delta", "coin_delta", "total_xp", "gold_coins")
SELECT "user_id", 'adjustment', 'Saldo inicial do extrato', "xp", "coins", "xp", "coins"
FROM "fitness_progress"
WHERE "xp" <> 0 OR "coins" <> 0;
