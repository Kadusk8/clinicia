ALTER TABLE "clinics" ADD COLUMN "google_calendar_id" varchar(255);--> statement-breakpoint
ALTER TABLE "clinics" ADD COLUMN "google_calendar_email" varchar(255);--> statement-breakpoint
ALTER TABLE "clinics" ADD COLUMN "google_refresh_token" text;--> statement-breakpoint
ALTER TABLE "clinics" ADD COLUMN "google_calendar_connected_at" timestamp;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "google_event_id" varchar(255);