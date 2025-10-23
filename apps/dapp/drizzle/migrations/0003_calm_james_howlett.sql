CREATE TABLE "energy_readings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "energy_readings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"timestamp" timestamp (3) NOT NULL,
	"production_kwh" numeric(10, 4),
	"consumption_kwh" numeric(10, 4) NOT NULL,
	"net_balance" numeric(10, 4) NOT NULL,
	"battery_soc" numeric(5, 2),
	"ev_soc" numeric(5, 2),
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vpp_aggregated_data" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vpp_aggregated_data_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"timestamp" timestamp (3) NOT NULL,
	"total_production_kwh" numeric(12, 4) NOT NULL,
	"total_consumption_kwh" numeric(12, 4) NOT NULL,
	"net_balance" numeric(12, 4) NOT NULL,
	"total_battery_capacity_kwh" numeric(12, 2) NOT NULL,
	"avg_battery_soc" numeric(5, 2),
	"total_ev_capacity_kwh" numeric(12, 2) NOT NULL,
	"avg_ev_soc" numeric(5, 2),
	"active_users_count" integer NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "vpp_aggregated_data_timestamp_unique" UNIQUE("timestamp")
);
--> statement-breakpoint
ALTER TABLE "energy_readings" ADD CONSTRAINT "energy_readings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "energy_readings_user_id_idx" ON "energy_readings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "energy_readings_timestamp_idx" ON "energy_readings" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "energy_readings_user_timestamp_idx" ON "energy_readings" USING btree ("user_id","timestamp");--> statement-breakpoint
CREATE INDEX "vpp_aggregated_data_timestamp_idx" ON "vpp_aggregated_data" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "vpp_aggregated_data_created_at_idx" ON "vpp_aggregated_data" USING btree ("created_at");