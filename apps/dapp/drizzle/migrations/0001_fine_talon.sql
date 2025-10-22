CREATE TABLE "battery_storages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "battery_storages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"energy_profile_id" integer NOT NULL,
	"capacity_kwh" numeric(10, 2) NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3),
	CONSTRAINT "battery_storages_energy_profile_id_unique" UNIQUE("energy_profile_id")
);
--> statement-breakpoint
CREATE TABLE "consumer_energy_data" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "consumer_energy_data_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"energy_profile_id" integer NOT NULL,
	"expected_consumption_kwh" numeric(10, 2) NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3),
	CONSTRAINT "consumer_energy_data_energy_profile_id_unique" UNIQUE("energy_profile_id")
);
--> statement-breakpoint
CREATE TABLE "electric_vehicles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "electric_vehicles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"energy_profile_id" integer NOT NULL,
	"battery_capacity_kwh" numeric(10, 2) NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3),
	CONSTRAINT "electric_vehicles_energy_profile_id_unique" UNIQUE("energy_profile_id")
);
--> statement-breakpoint
CREATE TABLE "energy_profiles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "energy_profiles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"role" varchar(50) NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3),
	CONSTRAINT "energy_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "producer_energy_data" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "producer_energy_data_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"energy_profile_id" integer NOT NULL,
	"solar_production_kwh" numeric(10, 2) NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3),
	CONSTRAINT "producer_energy_data_energy_profile_id_unique" UNIQUE("energy_profile_id")
);
--> statement-breakpoint
CREATE TABLE "prosumer_energy_data" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "prosumer_energy_data_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"energy_profile_id" integer NOT NULL,
	"solar_production_kwh" numeric(10, 2) NOT NULL,
	"expected_consumption_kwh" numeric(10, 2) NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3),
	CONSTRAINT "prosumer_energy_data_energy_profile_id_unique" UNIQUE("energy_profile_id")
);
--> statement-breakpoint
ALTER TABLE "battery_storages" ADD CONSTRAINT "battery_storages_energy_profile_id_energy_profiles_id_fk" FOREIGN KEY ("energy_profile_id") REFERENCES "public"."energy_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumer_energy_data" ADD CONSTRAINT "consumer_energy_data_energy_profile_id_energy_profiles_id_fk" FOREIGN KEY ("energy_profile_id") REFERENCES "public"."energy_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electric_vehicles" ADD CONSTRAINT "electric_vehicles_energy_profile_id_energy_profiles_id_fk" FOREIGN KEY ("energy_profile_id") REFERENCES "public"."energy_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "energy_profiles" ADD CONSTRAINT "energy_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producer_energy_data" ADD CONSTRAINT "producer_energy_data_energy_profile_id_energy_profiles_id_fk" FOREIGN KEY ("energy_profile_id") REFERENCES "public"."energy_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prosumer_energy_data" ADD CONSTRAINT "prosumer_energy_data_energy_profile_id_energy_profiles_id_fk" FOREIGN KEY ("energy_profile_id") REFERENCES "public"."energy_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "energy_profiles_role_idx" ON "energy_profiles" USING btree ("role");