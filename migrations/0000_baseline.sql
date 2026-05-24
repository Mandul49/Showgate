CREATE TABLE "event_config" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"config" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"organizer_id" varchar(36) NOT NULL,
	"title" text NOT NULL,
	"date" text NOT NULL,
	"location" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"max_tickets" integer NOT NULL,
	"payment_method" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"description" text,
	"cover_image_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"event_id" text,
	"ticket_type_id" text,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_phone" text NOT NULL,
	"instagram_handle" text,
	"ticket_type" text NOT NULL,
	"quantity" integer NOT NULL,
	"total_amount" integer NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organizers" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"business_name" text NOT NULL,
	"bank_name" text NOT NULL,
	"bank_code" text NOT NULL,
	"account_number" text NOT NULL,
	"subaccount_code" text NOT NULL,
	"bvn" text,
	"tier" text DEFAULT 'free' NOT NULL,
	"custom_brand_name" text,
	"custom_logo_url" text,
	"flutterwave_public_key" text,
	"flutterwave_secret_key" text,
	"brand_theme" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizers_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "subscription_references" (
	"reference" text PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"plan" text NOT NULL,
	"fulfilled_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_purchases" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"event_id" varchar(36) NOT NULL,
	"ticket_type_id" varchar(36) NOT NULL,
	"buyer_email" text NOT NULL,
	"buyer_name" text NOT NULL,
	"buyer_phone" text NOT NULL,
	"quantity" integer NOT NULL,
	"amount" integer NOT NULL,
	"reference" text NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_purchases_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "ticket_types" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"event_id" varchar(36) NOT NULL,
	"name" text NOT NULL,
	"price" integer NOT NULL,
	"quantity_available" integer NOT NULL,
	"quantity_sold" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'organizer' NOT NULL,
	"tier" text DEFAULT 'free' NOT NULL,
	"pro_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
