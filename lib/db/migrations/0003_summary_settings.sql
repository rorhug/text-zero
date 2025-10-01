-- Add summary settings columns to existing UserSettings table
ALTER TABLE `UserSettings` ADD COLUMN `summaryPrompt` text;
ALTER TABLE `UserSettings` ADD COLUMN `enableSummary` integer DEFAULT 0;
