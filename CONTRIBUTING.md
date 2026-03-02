# 🪄 Contributing to Document Agent

Thank you for your interest in contributing to Document Agent! 🎉

## Getting Started

### Setup

```bash
# Clone the repository
git clone https://github.com/ianlimle/icai-docs-agent.git
cd icai-docs-agent

# Install dependencies
npm install

# Start PostgreSQL via Docker Compose
npm run pg:start

# Generate and apply database migrations
cd apps/backend
npm run db:generate init
npm run db:push
cd ../..
```

> **Note:** The database migrations set up all required tables including users, projects, organizations, chats, messages, and more. PostgreSQL runs on port 8888 to avoid conflicts with local PostgreSQL instances. If you need to reset the database, run `npm run pg:reset`.

### Running the project

At the root of the project, run:

```bash
npm run dev
```

This will start the project in development mode. It will start the frontend and backend in development mode.

### Publishing to PyPI

```bash
npm run publish
```

By default, this will publish a patch version. You can specify a different version bump with:

```bash
npm run publish <major|minor|patch>
```

## Project Structure

```
chat/
├── apps/
│   ├── backend/     # Bun + Fastify + tRPC API server
│   └── frontend/    # React + Vite + TanStack Router
├── cli/             # Python CLI (nao-core package)
└── ...
```

## Development Commands

<!-- AUTO-GENERATED: Root package.json scripts -->
<!-- Generated from package.json - do not edit manually -->

| Command                     | Description                                                 |
| --------------------------- | ----------------------------------------------------------- |
| `npm run dev`               | Start all services (backend, frontend, fastapi) in parallel |
| `npm run dev:backend`       | Start backend with hot reload (Bun on port 5005)            |
| `npm run dev:fastapi`       | Start FastAPI Python server (port 8005)                     |
| `npm run dev:frontend`      | Start frontend with hot reload (Vite on port 3000)          |
| `npm run lint`              | Run linters on all workspaces (backend, frontend, shared)   |
| `npm run lint:backend`      | TypeScript type check + ESLint for backend                  |
| `npm run lint:frontend`     | TypeScript type check + ESLint for frontend                 |
| `npm run lint:shared`       | TypeScript type check + ESLint for shared                   |
| `npm run lint:fix`          | Auto-fix lint issues across all workspaces                  |
| `npm run lint:fix:backend`  | Auto-fix ESLint issues in backend                           |
| `npm run lint:fix:frontend` | Auto-fix ESLint issues in frontend                          |
| `npm run lint:fix:shared`   | Auto-fix ESLint issues in shared                            |
| `npm run format`            | Format code with Prettier                                   |
| `npm run format:check`      | Check code formatting with Prettier                         |
| `npm run cli:fix`           | Auto-fix Python lint issues (CLI)                           |
| `npm run cli:check`         | Check Python lint issues (CLI)                              |
| `npm run build:cli`         | Build CLI Python package with server binary                 |
| `npm run release`           | Run release script                                          |
| `npm run pg:start`          | Start PostgreSQL via docker-compose                         |
| `npm run pg:stop`           | Stop PostgreSQL containers                                  |
| `npm run pg:reset`          | Stop and remove PostgreSQL volumes                          |

<!-- END AUTO-GENERATED -->

### Backend Workspace Commands

<!-- AUTO-GENERATED: apps/backend/package.json scripts -->
<!-- Generated from apps/backend/package.json - do not edit manually -->

| Command                                       | Description                               |
| --------------------------------------------- | ----------------------------------------- |
| `npm run -w @nao/backend dev`                 | Start backend in watch mode (Bun)         |
| `npm run -w @nao/backend fastapi`             | Start FastAPI Python server               |
| `npm run -w @nao/backend build`               | Production build with esbuild             |
| `npm run -w @nao/backend build:standalone`    | Compile standalone binary with Bun        |
| `npm run -w @nao/backend start`               | Start production server                   |
| `npm run -w @nao/backend test`                | Run Vitest test suite                     |
| `npm run -w @nao/backend lint`                | TypeScript type check + ESLint            |
| `npm run -w @nao/backend lint:fix`            | Auto-fix ESLint issues                    |
| `npm run -w @nao/backend db:generate`         | Generate Drizzle migrations               |
| `npm run -w @nao/backend db:migrate`          | Apply database migrations                 |
| `npm run -w @nao/backend db:push`             | Push schema changes to database           |
| `npm run -w @nao/backend db:pull`             | Pull schema from database                 |
| `npm run -w @nao/backend db:studio`           | Open Drizzle Studio GUI                   |
| `npm run -w @nao/backend db:drop`             | Drop database tables                      |
| `npm run -w @nao/backend db:reset`            | Remove SQLite database file               |
| `npm run -w @nao/backend db:check-migrations` | Check for pending migrations              |
| `npm run -w @nao/backend format`              | Format code with Prettier                 |
| `npm run -w @nao/backend test:tool-outputs`   | Run tool output tests with verbose output |

<!-- END AUTO-GENERATED -->

### CLI Development Commands

<!-- AUTO-GENERATED: cli/Makefile -->
<!-- Generated from cli/Makefile - do not edit manually -->

| Command                   | Description                                           |
| ------------------------- | ----------------------------------------------------- |
| `cd cli && make lint`     | Run Python type checks, Ruff linter, and format check |
| `cd cli && make lint-fix` | Auto-fix import sorting and format with Ruff          |

<!-- END AUTO-GENERATED -->

## Environment Configuration

<!-- AUTO-GENERATED: .env.example variables -->
<!-- Generated from .env.example - do not edit manually -->

| Variable                   | Required | Description                                                             | Example/Default                                             |
| -------------------------- | -------- | ----------------------------------------------------------------------- | ----------------------------------------------------------- |
| `DB_URI`                   | No       | Database connection string (SQLite or PostgreSQL)                       | `sqlite:./db.sqlite` or `postgres://user:pass@host:8888/db` |
| `DB_QUERY_LOGGING`         | No       | Enable SQL query logging (set to 'true')                                | `true`                                                      |
| `POSTGRES_USER`            | No       | PostgreSQL username for docker-compose                                  | `document_agent`                                            |
| `POSTGRES_PASSWORD`        | No       | PostgreSQL password for docker-compose                                  | `document_agent`                                            |
| `POSTGRES_DB`              | No       | PostgreSQL database name for docker-compose                             | `document_agent`                                            |
| `BETTER_AUTH_SECRET`       | Yes      | Secret key for authentication (generate with `openssl rand -base64 32`) | Random base64 string                                        |
| `BETTER_AUTH_URL`          | Yes      | Public URL of your app for auth callbacks                               | `http://localhost:3000`                                     |
| `OPENAI_API_KEY`           | Yes\*    | OpenAI API key for LLM provider                                         | `sk-...`                                                    |
| `ANTHROPIC_API_KEY`        | Yes\*    | Anthropic API key for LLM provider                                      | `sk-ant-...`                                                |
| `SLACK_BOT_TOKEN`          | No       | Slack bot token for integration                                         | `xoxb-...`                                                  |
| `SLACK_SIGNING_SECRET`     | No       | Slack signing secret for integration                                    | `...`                                                       |
| `APP_VERSION`              | No       | Application version metadata                                            | `dev`                                                       |
| `APP_COMMIT`               | No       | Git commit hash for version tracking                                    | `unknown`                                                   |
| `APP_BUILD_DATE`           | No       | Build date for version tracking                                         | Empty                                                       |
| `NAO_DEFAULT_PROJECT_PATH` | Yes\*    | Path to Document Agent project context folder                           | `/path/to/project`                                          |
| `SMTP_HOST`                | No       | SMTP server hostname for email                                          | `smtp.gmail.com`                                            |
| `SMTP_SSL`                 | No       | Use SSL for SMTP (default: false)                                       | `false`                                                     |
| `SMTP_PORT`                | No       | SMTP server port (default: 587)                                         | `587`                                                       |
| `SMTP_MAIL_FROM`           | No       | From email address for SMTP                                             | `noreply@example.com`                                       |
| `SMTP_PASSWORD`            | No       | SMTP password                                                           | `password`                                                  |
| `GOOGLE_CLIENT_ID`         | No       | Google OAuth client ID                                                  | `...`                                                       |
| `GOOGLE_CLIENT_SECRET`     | No       | Google OAuth client secret                                              | `...`                                                       |
| `GOOGLE_AUTH_DOMAINS`      | No       | Allowed Google auth domains                                             | `example.com`                                               |
| `NOTION_API_KEY`           | No       | Notion API key for integration                                          | `...`                                                       |
| `POSTHOG_KEY`              | No       | PostHog project API key                                                 | `phc_...`                                                   |
| `POSTHOG_HOST`             | No       | PostHog host URL                                                        | `https://eu.i.posthog.com`                                  |
| `POSTHOG_DISABLED`         | No       | Disable PostHog tracking                                                | `false`                                                     |

\*At least one LLM provider API key is required (OpenAI or Anthropic).

<!-- END AUTO-GENERATED -->

## Making Changes

### Code Style

- Run `npm run lint:fix` before committing
- Run `npm run format` to format code with Prettier
- Follow existing patterns in the codebase

## Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Questions?

Thank you for contributing! 🙏
