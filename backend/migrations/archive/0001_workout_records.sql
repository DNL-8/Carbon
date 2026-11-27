CREATE TABLE "fitness_exercise_record" (
	"user_id" text NOT NULL,
	"exercise_id" text NOT NULL,
	"best_weight_kg" double precision NOT NULL,
	"best_reps" integer NOT NULL,
	"best_volume_kg" double precision NOT NULL,
	"estimated_1rm_kg" double precision NOT NULL,
	CONSTRAINT "fitness_exercise_record_user_id_exercise_id_pk" PRIMARY KEY("user_id","exercise_id")
);
--> statement-breakpoint
ALTER TABLE "fitness_exercise_record" ADD CONSTRAINT "fitness_exercise_record_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fitness_completion_owner_recent_idx" ON "fitness_completion" USING btree ("user_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);
--> statement-breakpoint
-- Initialize records from existing sets without changing the rewards of past workouts.
WITH performed_sets AS (
  SELECT workout.user_id, item->>'exerciseId' AS exercise_id,
         round(least(500, (item->>'weightKg')::numeric), 1) AS weight_kg,
         (item->>'reps')::integer AS reps
  FROM fitness_completion AS workout
  CROSS JOIN LATERAL jsonb_array_elements(workout.sets) AS item
)
INSERT INTO fitness_exercise_record
  (user_id, exercise_id, best_weight_kg, best_reps, best_volume_kg, estimated_1rm_kg)
SELECT user_id, exercise_id, max(weight_kg), max(reps), max(weight_kg * reps),
       max(round(CASE WHEN reps = 1 THEN weight_kg
         ELSE weight_kg * (1 + least(reps, 30)::numeric / 30) END, 1))
FROM performed_sets
GROUP BY user_id, exercise_id;
