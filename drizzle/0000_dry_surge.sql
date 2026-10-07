CREATE TABLE `config` (
	`id` integer PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE `destinations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`config_id` integer NOT NULL,
	`name` text NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`credentials` text,
	`storage_class` text DEFAULT 'STANDARD' NOT NULL,
	FOREIGN KEY (`config_id`) REFERENCES `config`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `destinations_config_id_unique` ON `destinations` (`config_id`);--> statement-breakpoint
CREATE TABLE `folder_naming_conventions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`config_id` integer NOT NULL,
	`pattern` text NOT NULL,
	FOREIGN KEY (`config_id`) REFERENCES `config`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`config_id` integer NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`credentials` text,
	FOREIGN KEY (`config_id`) REFERENCES `config`(`id`) ON UPDATE no action ON DELETE cascade
);
