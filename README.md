## TextZERO

## Running locally

This application is configured for running locally.

### Required Environment Variables

You only need two environment variables to get started:

1. `BEEPER_MCP_TOKEN` - Your Beeper MCP token for tool integration
2. `OPENAI_API_KEY` - Your OpenAI API key

### Quick Start

1. Copy the example environment file:

```bash
cp .env.example .env.local
```

2. Edit `.env.local` and add your tokens:

```
BEEPER_MCP_TOKEN=your_beeper_mcp_token_here
OPENAI_API_KEY=your_openai_api_key_here
```

3. Install dependencies and run:

```bash
npm install -g pnpm # if you don't have pnpm installed

pnpm install
pnpm dev
```

Your app should now be running on [localhost:3000](http://localhost:3000).

### Local Storage

The application uses:

- **SQLite** for the database (stored in `./data/sqlite.db`)
- **Local filesystem** for uploaded files (stored in `./public/uploads/`)

Both directories are automatically created on first run and are gitignored.

> Note: You should not commit your `.env.local` file as it contains sensitive API keys.
