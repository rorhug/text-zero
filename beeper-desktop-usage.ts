import { loadEnvConfig } from '@next/env';
const projectDir = process.cwd();
loadEnvConfig(projectDir);

import BeeperDesktop from '@beeper/desktop-api';

const accessToken = process.env.BEEPER_MCP_TOKEN;
if (!accessToken) {
  throw new Error('BEEPER_MCP_TOKEN is not set');
}

const client = new BeeperDesktop({
  accessToken, // This is the default and can be omitted
});

async function main() {
  const page = await client.chats.search({
    limit: 10,
    // query: 'Abel Ted',
    accountIDs: [
      'local-whatsapp_ba_MwWXILPi4fuepWBgdemXHN0R7n0',
      'local-whatsapp_ba_MwWXILPi4fuepWBgdemXHN0R7n0',
    ],
  });

  console.log(page.items);

  console.log(
    page.items
      .map((item) => `${item.title} ${item.lastActivity} - ${item.isArchived}`)
      .join('\n'),
  );
}

main();
