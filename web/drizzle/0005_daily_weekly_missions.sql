CREATE TABLE "fitness_weight_check_in" (
	"user_id" text NOT NULL,
	"day" text NOT NULL,
	"kg" double precision NOT NULL,
	CONSTRAINT "fitness_weight_check_in_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
ALTER TABLE "fitness_quest_claim" DROP CONSTRAINT "fitness_quest_claim_user_id_day_pk";--> statement-breakpoint
ALTER TABLE "fitness_quest_claim" ADD COLUMN "quest_id" text DEFAULT 'workout_today' NOT NULL;--> statement-breakpoint
ALTER TABLE "fitness_quest_claim" ADD CONSTRAINT "fitness_quest_claim_user_id_day_quest_id_pk" PRIMARY KEY("user_id","day","quest_id");--> statement-breakpoint
ALTER TABLE "fitness_completion" ADD COLUMN "record_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "fitness_weight_check_in" ADD CONSTRAINT "fitness_weight_check_in_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
