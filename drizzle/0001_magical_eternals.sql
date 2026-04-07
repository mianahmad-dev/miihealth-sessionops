CREATE TABLE `evaluation_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`ran_at` integer NOT NULL,
	`ran_by` text,
	`sample_count` integer NOT NULL,
	`schema_validity_pct` integer,
	`avg_llm_ms` integer,
	`tool_success_pct` integer,
	`escalation_precision_pct` integer,
	`results` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`ran_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `session_traces` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`turn_num` integer NOT NULL,
	`llm_ms` integer NOT NULL,
	`tool_ms` integer DEFAULT 0 NOT NULL,
	`total_ms` integer NOT NULL,
	`tool_call_count` integer DEFAULT 0 NOT NULL,
	`context_message_count` integer NOT NULL,
	`context_snapshot` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tool_invocations` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`turn_num` integer NOT NULL,
	`tool_name` text NOT NULL,
	`args` text NOT NULL,
	`result` text,
	`duration_ms` integer NOT NULL,
	`success` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `assistants` ADD `memory_mode` text DEFAULT 'full' NOT NULL;