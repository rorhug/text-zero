import { loadEnvConfig } from '@next/env';

const projectDir = process.cwd();
loadEnvConfig(projectDir);

import BeeperDesktop from '@beeper/desktop-api';

const accessToken = process.env.BEEPER_TOKEN;
if (!accessToken) {
  throw new Error('BEEPER_TOKEN is not set');
}

const client = new BeeperDesktop({
  accessToken, // This is the default and can be omitted
});

async function main() {
  const page = await client.chats.search({
    includeMuted: true,
    limit: 3,
    type: 'single',
  });
  const chat = page.items[0];

  console.log(chat.id);
}

void main();
