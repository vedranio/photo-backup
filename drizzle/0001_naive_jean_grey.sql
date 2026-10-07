PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_destinations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`config_id` integer NOT NULL,
	`name` text NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`credentials` text,
	`storage_class` text DEFAULT 'DEEP_ARCHIVE' NOT NULL,
	FOREIGN KEY (`config_id`) REFERENCES `config`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_destinations`("id", "config_id", "name", "location", "credentials", "storage_class") SELECT "id", "config_id", "name", "location", "credentials", "storage_class" FROM `destinations`;--> statement-breakpoint
DROP TABLE `destinations`;--> statement-breakpoint
ALTER TABLE `__new_destinations` RENAME TO `destinations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `destinations_config_id_unique` ON `destinations` (`config_id`);