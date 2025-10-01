import fs from 'fs';
import path from 'path';

/**
 * Parse .env file to extract existing keys
 */
function getExistingKeys(content: string): Set<string> {
  const keys = new Set<string>();
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    const match = trimmedLine.match(/^([^=]+)=/);
    if (match) {
      keys.add(match[1].trim());
    }
  }

  return keys;
}

/**
 * Add missing environment variables to .env.local
 * @param newEntries Object with key-value pairs to add if missing
 * @param envPath Path to .env.local file (defaults to .env.local in project root)
 * @returns Array of keys that were added
 */
export function addMissingEnvVars(
  newEntries: Record<string, string>,
  envPath: string = path.join(process.cwd(), '.env.local'),
): string[] {
  // Read existing .env.local or start with empty
  let existingContent = '';
  let existingKeys = new Set<string>();

  if (fs.existsSync(envPath)) {
    existingContent = fs.readFileSync(envPath, 'utf-8');
    existingKeys = getExistingKeys(existingContent);
  }

  // Determine which entries to add
  const addedKeys: string[] = [];
  const linesToAdd: string[] = [];

  for (const [key, value] of Object.entries(newEntries)) {
    if (!existingKeys.has(key)) {
      linesToAdd.push(`${key}=${value}`);
      addedKeys.push(key);
    }
  }

  // If nothing to add, return early
  if (linesToAdd.length === 0) {
    return addedKeys;
  }

  // Append new entries to existing content
  const newContent = existingContent
    ? `${existingContent.trimEnd()}\n\n${linesToAdd.join('\n')}\n`
    : `${linesToAdd.join('\n')}\n`;

  // Write back to file
  fs.writeFileSync(envPath, newContent, 'utf-8');

  return addedKeys;
}
