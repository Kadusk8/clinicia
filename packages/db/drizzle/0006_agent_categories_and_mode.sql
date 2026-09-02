CREATE TABLE "agent_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"key" varchar(100) NOT NULL,
	"label" varchar(255) NOT NULL,
	"system_prompt" text,
	"knowledge_base" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "clinics" ADD COLUMN "agent_mode" varchar(20) DEFAULT 'single' NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "category_key" text;--> statement-breakpoint
ALTER TABLE "agent_categories" ADD CONSTRAINT "agent_categories_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;