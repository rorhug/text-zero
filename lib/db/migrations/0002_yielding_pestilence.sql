-- Add reminder settings columns to existing UserSettings table
ALTER TABLE `UserSettings` ADD COLUMN `remind5min` integer DEFAULT 5;
ALTER TABLE `UserSettings` ADD COLUMN `remind30min` integer DEFAULT 30;
ALTER TABLE `UserSettings` ADD COLUMN `remind1h` integer DEFAULT 60;
ALTER TABLE `UserSettings` ADD COLUMN `remind3h` integer DEFAULT 180;
ALTER TABLE `UserSettings` ADD COLUMN `remindTomorrowMorning` text DEFAULT '09:00';
ALTER TABLE `UserSettings` ADD COLUMN `remindTomorrowMidday` text DEFAULT '12:00';
ALTER TABLE `UserSettings` ADD COLUMN `remindTomorrowEvening` text DEFAULT '18:00';
