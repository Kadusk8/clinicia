CREATE TABLE "super_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "super_admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DROP INDEX "kb_chunks_embedding_idx";--> statement-breakpoint
ALTER TABLE "clinics" ADD COLUMN "evolution_api_url" varchar(255);--> statement-breakpoint
ALTER TABLE "clinics" ADD COLUMN "evolution_api_key" varchar(255);--> statement-breakpoint
ALTER TABLE "clinics" ADD COLUMN "whatsapp_connected" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "clinics" ADD COLUMN "agent_system_prompt" text;--> statement-breakpoint
ALTER TABLE "clinics" ADD COLUMN "agent_knowledge_base" text;--> statement-breakpoint
ALTER TABLE "clinics" ADD COLUMN "suspended_at" timestamp;--> statement-breakpoint
ALTER TABLE "clinics" ADD COLUMN "suspended_reason" varchar(500);--> statement-breakpoint
CREATE INDEX "kb_chunks_embedding_idx" ON "kb_chunks" USING hnsw ("embedding" vector_cosine_ops);