CREATE TABLE "fitness_arsenal" (
	"user_id" text PRIMARY KEY NOT NULL,
	"owned" jsonb NOT NULL,
	"equipped" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fitness_custom_workout" (
	"user_id" text NOT NULL,
	"id" text NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "fitness_custom_workout_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "fitness_hero_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fitness_quest_claim" (
	"user_id" text NOT NULL,
	"day" text NOT NULL,
	"xp" integer NOT NULL,
	"coins" integer NOT NULL,
	CONSTRAINT "fitness_quest_claim_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
ALTER TABLE "fitness_completion" ADD COLUMN "workout_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "fitness_arsenal" ADD CONSTRAINT "fitness_arsenal_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitness_custom_workout" ADD CONSTRAINT "fitness_custom_workout_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitness_hero_profile" ADD CONSTRAINT "fitness_hero_profile_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitness_quest_claim" ADD CONSTRAINT "fitness_quest_claim_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;