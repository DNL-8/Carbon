CREATE TABLE "fitness_achievement" (
	"user_id" text NOT NULL,
	"id" text NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fitness_achievement_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "fitness_daily_vow" (
	"user_id" text NOT NULL,
	"id" text NOT NULL,
	"title" text NOT NULL,
	"resolved_day" text,
	"outcome" text,
	CONSTRAINT "fitness_daily_vow_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
ALTER TABLE "fitness_progress" ADD COLUMN "hp" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "fitness_achievement" ADD CONSTRAINT "fitness_achievement_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitness_daily_vow" ADD CONSTRAINT "fitness_daily_vow_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;