CREATE TABLE "fitness_health_activity" (
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"xp" integer NOT NULL,
	CONSTRAINT "fitness_health_activity_user_id_source_external_id_pk" PRIMARY KEY("user_id","source","external_id")
);
--> statement-breakpoint
CREATE TABLE "fitness_health_metric" (
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"date_key" text NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "fitness_health_metric_user_id_source_date_key_pk" PRIMARY KEY("user_id","source","date_key")
);
--> statement-breakpoint
ALTER TABLE "fitness_health_activity" ADD CONSTRAINT "fitness_health_activity_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fitness_health_metric" ADD CONSTRAINT "fitness_health_metric_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;