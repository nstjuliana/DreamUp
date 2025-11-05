# DreamUp QA Pipeline

AI-powered browser game testing system that autonomously tests games through browser automation, captures evidence, evaluates playability, and stores results for analysis.

## Status

**Current Phase**: MVP & Web UI Complete ✅

The project is fully functional with:
- ✅ Complete browser automation (Browserbase + Stagehand)
- ✅ Game interaction and gameplay simulation
- ✅ Evidence capture (screenshots, console logs)
- ✅ AI-powered LLM evaluation
- ✅ Database and file storage (Supabase)
- ✅ CLI interface for testing
- ✅ Web dashboard for game management
- ✅ Manifest generator UI
- ✅ Test results viewing and analysis

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org) >= 18.0.0
- [Supabase](https://supabase.com) account
- [Browserbase](https://browserbase.com) account (pending setup)
- OpenAI API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd DreamUp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase database**
   - Open your Supabase project dashboard
   - Navigate to SQL Editor
   - Run the SQL migration from `database-migration.sql`
   - See `DATABASE_SETUP.md` for detailed instructions

4. **Generate TypeScript types from database**
   ```bash
   npx supabase gen types typescript --project-id <your-project-id> > src/storage/types.ts
   ```

5. **Configure environment variables**
   - Create a `.env` file in the root directory
   - See `ENV_SETUP.md` for required variables
   - Fill in your Supabase, Browserbase, and LLM API credentials

6. **Set up Web UI (Optional)**
   ```bash
   cd src/web
   npm install
   ```

### Verify Setup

Check that TypeScript compiles without errors:
```bash
npm run type-check
```

Test the CLI (with environment variables configured):
```bash
npm start -- --help
```

Start the Web UI (from project root):
```bash
cd src/web
npm run dev
```

Visit `http://localhost:3000` to access the web dashboard.

## Project Structure

```
DreamUp/
├── src/
│   ├── agent/              # QA agent orchestration
│   ├── browser/            # Browser automation (Browserbase + Stagehand)
│   ├── evaluation/         # LLM evaluation
│   ├── storage/            # Database & file storage (Supabase)
│   ├── cli/                # CLI commands
│   ├── lambda/             # Lambda handlers
│   ├── utils/              # Shared utilities
│   └── web/                # Web UI (Next.js)
│       ├── app/            # Next.js app router pages & API routes
│       ├── components/    # React components
│       └── lib/            # Web-specific utilities
├── artifacts/              # Local artifact storage (fallback)
├── _docs/                  # Project documentation
├── qa.ts                   # CLI entry point
└── package.json
```

## Usage

### CLI Usage

**Run QA Test** (game must exist in database):
```bash
npm start -- --url <game-url>
```

**With Manifest Version**:
```bash
npm start -- --url <game-url> --manifest v1.0
```

**Skip Manifest**:
```bash
npm start -- --url <game-url> --no-manifest
```

**Enable Debug Logging**:
```bash
DEBUG=true npm start -- --url <game-url>
```

### Web UI Usage

1. **Start the development server**:
   ```bash
   cd src/web
   npm run dev
   ```

2. **Access the dashboard**:
   - Open `http://localhost:3000` in your browser
   - View games library, create new games, manage manifests
   - Run tests directly from the web interface
   - View detailed test results with screenshots and console logs

3. **Key Features**:
   - **Games Library**: Browse all games with stats and last test results
   - **Create Game**: Add new games with visual manifest generator
   - **Game Detail**: View game info, manifests, and test history
   - **Run Test**: Execute tests from the web UI with real-time status updates
   - **Test Results**: View detailed results with screenshots, console logs, and playability scores

## Development

### Type Checking

```bash
npm run type-check
```

### Run Development Mode

```bash
npm run dev
```

## Architecture

### Core Modules

- **agent/**: Orchestrates the complete QA workflow
- **browser/**: Handles browser automation via Browserbase/Stagehand
- **evaluation/**: LLM-based game evaluation
- **storage/**: Database operations (Supabase) and file storage
- **cli/**: Command-line interface
- **utils/**: Shared utilities (config, errors, logging, constants)

### Technology Stack

**Backend/Core**:
- **Runtime**: Node.js (with tsx for TypeScript execution)
- **Language**: TypeScript (strict mode)
- **Database**: Supabase (PostgreSQL)
- **File Storage**: Supabase Storage
- **Browser Automation**: Browserbase + Stagehand
- **AI/LLM**: OpenAI API (structured outputs)
- **CLI**: Commander.js

**Web UI**:
- **Framework**: Next.js 14 (App Router)
- **UI Components**: shadcn/ui + Radix UI
- **Styling**: Tailwind CSS
- **Type Safety**: TypeScript

## Documentation

**Implementation Guides**:
- **Setup Phase**: `_docs/phases/setup-phase.md`
- **MVP Phase**: `_docs/phases/mvp-phase.md` (✅ Complete)
- **Enhancement Phase 1**: `_docs/phases/enhancement-phase-1.md` (✅ Complete)
- **Enhancement Phase 2**: `_docs/phases/enhancement-phase-2.md`
- **Stretch Phase**: `_docs/phases/stretch-phase.md` (Web UI ✅ Complete)

**Reference Documentation**:
- **Database Schema**: `_docs/database-schema.md`
- **Game Manifest Schema**: `_docs/game-manifest-schema.md`
- **Architecture**: `_docs/architecture-summary.md`
- **Project Rules**: `_docs/project-rules.md`
- **MVP Implementation Summary**: `MVP_IMPLEMENTATION_SUMMARY.md`
- **MVP Test Guide**: `MVP_TEST_GUIDE.md`

## Features

### Core Features (Implemented ✅)

**Browser Automation**:
- ✅ Browserbase + Stagehand integration
- ✅ Game URL loading with retry logic
- ✅ AI-powered game interaction
- ✅ Keyboard and mouse input simulation
- ✅ Manifest-guided testing for improved accuracy

**Evidence Capture**:
- ✅ Multiple screenshot capture (3-5 per test)
- ✅ Console log collection and categorization
- ✅ Timestamped artifacts with organized storage
- ✅ Upload to Supabase Storage with public URLs

**AI Evaluation**:
- ✅ LLM-based playability assessment
- ✅ Structured evaluation with confidence scores
- ✅ Issue detection and categorization
- ✅ Retry logic with exponential backoff

**Data Management**:
- ✅ Database storage (games, manifests, test runs)
- ✅ File storage (screenshots, logs)
- ✅ Game lookup and manifest versioning
- ✅ Test result persistence

**CLI Interface**:
- ✅ Command-line testing execution
- ✅ JSON output formatting
- ✅ Debug logging support
- ✅ Error handling and validation

**Web Dashboard**:
- ✅ Games library with statistics
- ✅ Visual manifest generator (no JSON editing required)
- ✅ Manifest versioning UI
- ✅ Test execution from web interface
- ✅ Detailed test results viewing
- ✅ Screenshot gallery and console log viewer
- ✅ Playability score visualization

### Planned (Future Enhancements)

- 📋 Batch testing (multiple games at once)
- 📋 Advanced metrics (FPS, load time, performance)
- 📋 GIF recording of test sessions
- 📋 Lambda deployment for automated testing
- 📋 Real-time progress updates (WebSocket/SSE)
- 📋 Test result export (CSV, JSON)
- 📋 LLM model comparison tool

## License

MIT

## Contributing

This is a project for the Gauntlet C3 program. See `_docs/project-rules.md` for coding standards and conventions.

