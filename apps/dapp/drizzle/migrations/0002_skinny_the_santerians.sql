ALTER TABLE "energy_profiles" DROP CONSTRAINT "energy_profiles_user_id_unique";--> statement-breakpoint
ALTER TABLE "energy_profiles" DROP CONSTRAINT "energy_profiles_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "energy_profile_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_energy_profile_id_energy_profiles_id_fk" FOREIGN KEY ("energy_profile_id") REFERENCES "public"."energy_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "energy_profiles" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "energy_profiles" ADD CONSTRAINT "energy_profiles_role_unique" UNIQUE("role");