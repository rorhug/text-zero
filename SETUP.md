# Local Setup Guide

This application has been configured to run entirely on your laptop without requiring any cloud services.

## What Changed

### Environment Variables - Before vs After

**Before (5 required variables):**
- ❌ `AUTH_SECRET` - Required authentication secret
- ❌ `AI_GATEWAY_API_KEY` - Vercel AI Gateway key
- ❌ `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage token
- ❌ `POSTGRES_URL` - PostgreSQL database URL
- ❌ `REDIS_URL` - Redis connection URL (optional but recommended)

**After (2 required variables):**
- ✅ `BEEPER_MCP_TOKEN` - Your Beeper MCP token
- ✅ `OPENAI_API_KEY` - Your OpenAI API key

### Infrastructure Changes

1. **Database: PostgreSQL → SQLite**
   - Database stored locally at `./data/sqlite.db`
   - Automatically created on first run
   - No external database service needed

2. **File Storage: Vercel Blob → Local Filesystem**
   - Uploaded files stored in `./public/uploads/`
   - Automatically created on first run
   - Files are served directly by Next.js

3. **Authentication: Static Secret**
   - Uses a hardcoded development secret by default
   - No need to manage `AUTH_SECRET` for local development
   - Can be overridden via env var if needed

4. **AI Gateway: Direct OpenAI**
   - Connects directly to OpenAI API
   - No Vercel AI Gateway needed
   - Simpler configuration

5. **Redis: Optional (Already Was)**
   - Used for resumable streams
   - App gracefully handles absence
   - Not required for core functionality

## Quick Start

1. **Copy environment file:**
   ```bash
   cp .env.local.example .env.local
   ```

2. **Add your API keys to `.env.local`:**
   ```
   BEEPER_MCP_TOKEN=your_beeper_mcp_token_here
   OPENAI_API_KEY=your_openai_api_key_here
   ```

3. **Install and run:**
   ```bash
   pnpm install
   pnpm dev
   ```

4. **Open in browser:**
   ```
   http://localhost:3000
   ```

## Database Management

The app uses SQLite with Drizzle ORM:

```bash
# Generate new migrations after schema changes
pnpm db:generate

# Apply migrations
pnpm db:migrate

# Open Drizzle Studio to view/edit data
pnpm db:studio

# Push schema changes directly (dev only)
pnpm db:push
```

## File Structure

```
/workspace
├── data/
│   └── sqlite.db          # SQLite database (auto-created)
├── public/
│   └── uploads/           # Uploaded files (auto-created)
├── .env.local             # Your environment variables (gitignored)
└── .env.local.example     # Template for environment variables
```

## Troubleshooting

### Database Issues

If you encounter database errors, try deleting and recreating:

```bash
rm -rf data/
pnpm db:migrate
```

### Upload Issues

If file uploads fail, ensure the uploads directory exists:

```bash
mkdir -p public/uploads
chmod 755 public/uploads
```

### Missing Dependencies

If you get module not found errors:

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

## Optional Configuration

You can override defaults by adding these to `.env.local`:

```bash
# Custom database location
DATABASE_URL=./my-custom-db.db

# Custom auth secret (32+ characters)
AUTH_SECRET=your-custom-secret-here

# Redis for resumable streams (optional)
REDIS_URL=redis://localhost:6379
```

## Production Deployment

While this app is optimized for local development, if you want to deploy it:

1. Set a strong `AUTH_SECRET` (use `openssl rand -base64 32`)
2. Consider using a hosted SQLite solution (Turso, LiteFS, etc.)
3. Use cloud storage for uploads (S3, Cloudflare R2, etc.)
4. Add Redis for resumable streams

## Development Notes

- Both `data/` and `public/uploads/` are in `.gitignore`
- The database is automatically migrated on `pnpm build`
- File uploads use timestamps to prevent naming collisions
- Guest users are auto-created when not logged in
