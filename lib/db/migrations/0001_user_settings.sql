CREATE TABLE `UserSettings` (
  `userId` text PRIMARY KEY NOT NULL,
  `suggestionPrompt` text,
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `idx_UserSettings_userId` ON `UserSettings` (`userId`);

