-- Add archive action setting to UserSettings
ALTER TABLE `UserSettings` ADD COLUMN `archiveAction` text DEFAULT 'next_conversation';

