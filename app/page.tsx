import { redirect } from 'next/navigation';

export default async function Page() {
  const beeperToken = process.env.BEEPER_MCP_TOKEN;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!beeperToken || !openaiKey) {
    redirect('/setup');
  }

  redirect('/inbox');
}
