# Tech Stack: DreamUp QA Pipeline

## Summary

**Runtime:** Bun  
**Database:** Supabase (PostgreSQL)  
**File Storage:** Supabase Storage  
**AI/LLM SDK:** Vercel AI SDK  
**Browser Automation:** Browserbase + Stagehand  
**CLI Framework:** Commander.js  
**Package Manager:** Bun  
**Lambda Deployment:** AWS Lambda  
**Web Framework (Stretch):** Next.js

---

This document outlines the complete technology stack for the DreamUp QA Pipeline project, including best practices, limitations, and important considerations for each technology.

## Core Stack Decisions

### Runtime: Bun

**Decision:** Use Bun as the primary runtime for TypeScript execution.

**Rationale:**
- Fast startup time crucial for CLI tool responsiveness
- Native TypeScript support eliminates need for transpilation
- Built-in package manager simplifies dependency management
- Matches project specification example (`bun run qa.ts`)

**Best Practices:**
- Use `.bun` directory for cached dependencies (faster installs)
- Use `bun --bun` flag to ensure Bun runtime (not Node.js fallback)
- Keep files under 500 lines for AI tool compatibility

**Limitations:**
- Newer ecosystem with fewer community resources than Node.js
- Some npm packages may have compatibility issues (test thoroughly)
- Lambda deployment requires bundling (use `bun build` or esbuild)
- Less mature debugging tools compared to Node.js

**Important Considerations:**
- Always test Lambda deployments with bundled code
- Some libraries may require Node.js polyfills (Bun handles most automatically)
- Use `bun install --frozen-lockfile` in CI/CD for reproducible builds

**Common Pitfalls:**
- Assuming all npm packages work perfectly (test compatibility)
- Not bundling properly for Lambda (can cause runtime errors)
- Forgetting to specify `--bun` flag in scripts

---

### Database: Supabase (PostgreSQL)

**Decision:** Use Supabase as the managed PostgreSQL database service.

**Rationale:**
- Fast setup with generous free tier
- Built-in TypeScript SDK for type-safe queries
- Includes authentication and storage in same platform
- REST API auto-generated from database schema
- Real-time subscriptions available if needed

**Database Schema:**

The application uses three main tables:
- **`games`**: Central repository of browser games (URL, name, type, active manifest)
- **`game_manifests`**: Version-controlled manifests for each game (1-to-many with games)
- **`test_runs`**: Historical record of all test executions (linked to game + manifest)

See `_docs/database-schema.md` for complete schema definition, relationships, indexes, and TypeScript types.

**Best Practices:**
- Use Supabase TypeScript client for all database operations
- Generate database types from schema using `supabase gen types typescript` → `src/storage/types.ts`
- Use Row Level Security (RLS) policies for data access control (currently public for MVP)
- Implement connection pooling for Lambda functions
- Use migrations via Supabase CLI for schema changes
- Store large artifacts (screenshots, logs) in Supabase Storage, not database

**Limitations:**
- Vendor lock-in (data tied to Supabase platform)
- Network latency for Lambda functions (consider connection pooling)
- Free tier has rate limits (100,000 monthly active users)
- Database size limits on free tier (500 MB)

**Important Considerations:**
- Store connection strings in environment variables (never commit)
- Use connection pooling for serverless (Lambda) contexts
- Plan for schema migrations early (version control migrations)
- Monitor query performance (Supabase dashboard provides insights)

**Common Pitfalls:**
- Not using connection pooling in Lambda (exhausts connections quickly)
- Forgetting to enable RLS policies (security risk)
- Storing large JSON blobs directly in database (use Storage instead)
- Not handling connection timeouts gracefully

---

### File Storage: Supabase Storage

**Decision:** Use Supabase Storage for screenshots, logs, and other artifacts.

**Rationale:**
- Same platform as database (unified authentication/billing)
- Serverless-friendly with URL-based access
- Free tier includes 1 GB storage
- CDN integration for fast file access
- Easy integration with Supabase client library

**Best Practices:**
- Organize files in bucket structure: `artifacts/{testId}/screenshots/` and `artifacts/{testId}/logs/`
- Use public buckets for web UI image display, private buckets for sensitive logs
- Store file paths/URLs in database, not full file content
- Implement cleanup jobs for old artifacts (prevent storage bloat)
- Use appropriate file naming conventions (timestamps, test IDs)

**Limitations:**
- Free tier: 1 GB storage, 2 GB bandwidth/month
- File upload size limit: 50 MB per file (configurable)
- No built-in image transformations on free tier (upgrade for that)
- Rate limits apply (same as database tier)

**Important Considerations:**
- Set up bucket policies properly (public vs private access)
- Implement file retention policies (delete old test artifacts)
- Handle upload failures gracefully (retry logic)
- Consider image compression before upload (reduce storage costs)

**Common Pitfalls:**
- Uploading files without proper error handling
- Not cleaning up old files (storage costs accumulate)
- Storing files with same names (overwrites)
- Forgetting to set proper bucket permissions (public vs private)

---

### AI/LLM SDK: Vercel AI SDK

**Decision:** Use Vercel AI SDK for LLM integration and game evaluation.

**Rationale:**
- Recommended in project specification
- Provider-agnostic (can switch between OpenAI, Anthropic, etc.)
- Built-in support for structured outputs (JSON responses)
- Streaming support for real-time responses
- Strong TypeScript support

**Best Practices:**
- Use `ai` package from Vercel (`npm install ai`)
- Implement structured outputs for consistent JSON responses
- Use environment variables for API keys (never commit)
- Implement retry logic with exponential backoff
- Cache LLM responses when possible (cost optimization)
- Use streaming only if real-time updates needed (otherwise batch)

**Limitations:**
- Relatively new project (smaller community than direct provider SDKs)
- Some advanced provider features may not be available
- Requires understanding of provider-specific configurations
- Token usage tracking requires manual implementation

**Important Considerations:**
- Monitor API costs closely (set budget alerts)
- Implement rate limiting to prevent excessive API calls
- Use appropriate model for task (don't use GPT-4 for simple checks)
- Implement fallback logic if LLM fails (heuristic-based assessment)
- Structure prompts carefully for consistent JSON output

**Common Pitfalls:**
- Not setting proper token limits (can cause excessive costs)
- Forgetting to handle API failures gracefully
- Not validating structured outputs (may not match schema)
- Using expensive models when cheaper ones suffice
- Not implementing caching (repeated evaluations waste money)

---

### CLI Framework: Commander.js

**Decision:** Use Commander.js for command-line argument parsing and CLI structure.

**Rationale:**
- Industry standard for Node.js/Bun CLIs
- Mature and well-documented
- TypeScript support available
- Handles help text generation automatically
- Supports subcommands (useful for future expansion)

**Best Practices:**
- Use Commander.js with TypeScript types (`@types/commander`)
- Define commands in separate modules for organization
- Use `.description()` and `.version()` for proper CLI help
- Validate required arguments early
- Use `.option()` with flags for optional parameters (e.g., `--manifest`)
- Implement proper error messages for invalid input

**Limitations:**
- Adds dependency to project
- Some boilerplate for simple commands
- Learning curve for advanced features

**Important Considerations:**
- Parse arguments before executing main logic
- Handle help flags (`--help`, `-h`) gracefully
- Validate URLs and file paths before processing
- Provide clear error messages for invalid inputs

**Common Pitfalls:**
- Not validating arguments before use (causes runtime errors)
- Poor error messages (confusing for users)
- Not handling edge cases in argument parsing

---

### Package Manager: Bun

**Decision:** Use Bun as the package manager (bundled with Bun runtime).

**Rationale:**
- Integrated with Bun runtime (single tool)
- Fastest package installation available
- No separate tooling needed
- Lock file format compatible with npm

**Best Practices:**
- Commit `bun.lockb` file to version control
- Use `bun install --frozen-lockfile` in CI/CD
- Keep dependencies minimal (faster installs, smaller bundles)
- Regularly update dependencies (`bun update`)
- Use `bun add` for new packages (not npm install)

**Limitations:**
- Requires Bun runtime (not available without Bun)
- Lock file is binary format (not human-readable)
- Some packages may need Node.js-specific configurations

**Important Considerations:**
- Lock file should always be committed to git
- Test after dependency updates (compatibility issues possible)
- Use `bun pm` commands for package management utilities

**Common Pitfalls:**
- Not committing lock file (reproducibility issues)
- Mixing npm and bun commands (inconsistent lock files)
- Not testing after updates (breaking changes)

---

### Browser Automation: Browserbase + Stagehand

**Decision:** Use Browserbase with Stagehand for browser automation (already decided).

**Rationale:**
- Recommended in project specification
- Stagehand provides AI-powered browser automation
- Browserbase handles infrastructure (headless browsers)
- Good integration for AI agent workflows

**Best Practices:**
- Store Browserbase API keys in environment variables
- Use Stagehand's `@browserbasehq/stagehand` package
- Implement proper timeouts for all browser operations
- Capture screenshots at key interaction points
- Monitor browser session usage (costs money per minute)
- Close browser sessions properly (avoid resource leaks)

**Limitations:**
- Costs per browser-hour (monitor usage)
- Network latency for remote browser sessions
- Limited control over browser environment
- Rate limits may apply

**Important Considerations:**
- Always set max execution time (5 minutes per spec)
- Implement retry logic for failed page loads
- Capture console logs early (before navigation)
- Handle browser crashes gracefully

**Common Pitfalls:**
- Not closing browser sessions (costs accumulate)
- Exceeding timeout limits (failed tests)
- Not capturing screenshots before navigation
- Assuming all games load in headless mode (test thoroughly)

---

### Lambda Deployment: AWS Lambda with TypeScript Bundling

**Decision:** Use AWS Lambda for autonomous/automatic test execution.

**Rationale:**
- Matches existing DreamUp infrastructure (game dev agent runs in Lambda)
- Serverless scales automatically
- Pay-per-use pricing model
- Integrates with other AWS services

**Best Practices:**
- Bundle TypeScript code with `bun build` or `esbuild` before deployment
- Keep bundle size under 50 MB (Lambda limit)
- Use Lambda layers for shared dependencies if needed
- Implement proper error handling and logging
- Set appropriate timeout (Lambda max is 15 minutes, spec requires 5 min)
- Use environment variables for all configuration
- Implement proper IAM roles (least privilege principle)

**Limitations:**
- Cold start latency (first invocation slower)
- 15-minute maximum execution time
- 50 MB deployment package limit (10 MB direct upload)
- Memory and CPU limits based on configuration

**Important Considerations:**
- Test Lambda function locally before deployment
- Monitor CloudWatch logs for errors
- Set up proper IAM permissions for Supabase/S3 access
- Consider provisioned concurrency if cold starts are problematic
- Use Lambda environment variables for sensitive data

**Common Pitfalls:**
- Bundle size too large (deployment fails)
- Not handling timeouts properly (partial results)
- Cold start issues (first test slower)
- Missing environment variables (runtime errors)
- Insufficient IAM permissions (access denied)

---

## Additional Technologies

### Web Framework (Stretch Feature): Next.js

**Decision:** Use Next.js if building web UI dashboard (stretch feature).

**Rationale:**
- Full-stack framework with API routes
- Server-side rendering for better performance
- TypeScript-first approach
- Easy deployment to Vercel or AWS

**Best Practices:**
- Use App Router (Next.js 13+ pattern)
- Implement API routes for test submission and results
- Use server components where possible
- Client components only for interactive UI

**Note:** Web UI is optional stretch feature. Core MVP focuses on CLI and Lambda execution.

---

## Environment Variables

All sensitive configuration should use environment variables:

```bash
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Browserbase
BROWSERBASE_API_KEY=
BROWSERBASE_PROJECT_ID=

# LLM Provider (e.g., OpenAI)
OPENAI_API_KEY=
# or
ANTHROPIC_API_KEY=

# AWS Lambda (if needed)
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

**Never commit these to version control.** Use `.env.example` file to document required variables.

---

## Project Structure Recommendations

```
dreamup-qa/
├── src/
│   ├── agent/           # Core QA agent logic
│   ├── browser/         # Browser automation (Browserbase/Stagehand)
│   ├── evaluation/      # LLM evaluation module
│   ├── storage/         # Database and file storage operations
│   ├── cli/             # CLI command definitions
│   └── utils/           # Shared utilities
├── artifacts/           # Local artifact storage (optional fallback)
├── qa.ts                # Main CLI entry point
├── bun.lockb            # Bun lock file (commit this)
├── package.json
└── tsconfig.json
```

---

## Development Workflow

1. **Local Development:**
   - Use `bun run qa.ts <game-url>` for testing
   - Store artifacts locally or in Supabase Storage
   - Use `.env.local` for local environment variables

2. **Lambda Deployment:**
   - Bundle code with `bun build`
   - Deploy to AWS Lambda via CLI or CI/CD
   - Set environment variables in Lambda configuration

---

## Cost Considerations

- **Browserbase:** Free tier includes 1 browser-hour, then pay-per-use
- **Supabase:** Free tier generous but monitor usage
- **LLM API:** Major cost driver - use cheaper models when possible, cache responses
- **AWS Lambda:** Very cheap for low volume, scales with usage
- **Supabase Storage:** 1 GB free, then pay-per-GB

Monitor costs regularly, especially LLM API usage.

---

## Important Notes

- All files should stay under 500 lines for AI tool compatibility
- Use TypeScript strict mode
- Document all functions with JSDoc/TSDoc comments
- Implement proper error handling at every level
- Test on diverse game types before considering complete
- Keep dependencies minimal (faster installs, easier debugging)

