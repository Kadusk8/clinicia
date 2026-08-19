ALTER TABLE "patients" ADD COLUMN "contact_reason" varchar(255);--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "first_visit" boolean;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "urgency_level" varchar(10);--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "complaint_summary" text;