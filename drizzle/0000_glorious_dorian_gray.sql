CREATE TABLE `assistants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`purpose` text NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`voice` text DEFAULT 'default' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`tools` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`changes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`assistant_id` text NOT NULL,
	`assistant_version` integer NOT NULL,
	`operator_id` text NOT NULL,
	`status` text NOT NULL,
	`started_at` integer,
	`ended_at` integer,
	`duration_sec` integer,
	`turn_count` integer DEFAULT 0,
	`summary` text,
	`error_reason` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`assistant_id`) REFERENCES `assistants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `transcript_events` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`speaker` text NOT NULL,
	`content` text NOT NULL,
	`timestamp_ms` integer NOT NULL,
	`sequence_num` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);