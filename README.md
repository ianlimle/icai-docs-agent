## What is Document Agent?

Document Agent is a framework to build and deploy analytics agent. <br/>
Create the context of your analytics agent with the CLI: data, metadata, modeling, rules, etc. <br/>
Deploy a UI for anyone to chat with your agent and run analytics on your data.

### How It Works

**Context as Files:**
All context (database schemas, documentation, code, business rules) is stored as markdown files in the project folder:

```
project/
├── databases/          # Database metadata (auto-synced)
│   └── type=postgres/database=mydb/schema=public/table=users/
│       ├── columns.md       # Schema definitions
│       ├── preview.md       # Sample data
│       └── description.md   # Table documentation
├── repos/              # Git repositories (cloned as files)
├── docs/               # Documentation files
│   ├── notion/         # Notion page exports
│   ├── confluence/     # Confluence page exports
│   └── *.md            # Uploaded documentation files
├── semantics/          # Business rules and definitions
└── agent/              # Custom tools and skills
```

**Tool-Based Retrieval:**

Instead of pre-indexed vector similarity, the agent actively searches using tools:

| Tool          | Purpose                         | Implementation            |
| ------------- | ------------------------------- | ------------------------- |
| `read`        | Read file contents              | Node.js `fs.readFile()`   |
| `search`      | Find files by glob pattern      | `glob()` pattern matching |
| `grep`        | Search file contents with regex | `ripgrep` binary          |
| `list`        | List directory contents         | Node.js `fs.readdir()`    |
| `execute_sql` | Query databases directly        | Ibis ORM connection       |

**Example Flow:**

```
User: "What's our customer churn rate?"

Agent Thinking:
1. I need to find customer-related tables
2. Use `search` tool with pattern "**/database=*/schema=*/table=*customer*"
3. Read `columns.md` files to understand schema
4. Use `execute_sql` to calculate churn
5. Generate response with SQL and results
```

This approach puts the **intelligence in the agent** rather than pre-computed retrieval, enabling more flexible and context-aware responses.

## Key Features

For **data teams**:

- 🧱 **Open Context Builder** — Create a file-system like context for your agent. Add anything you want in the context: data, metadata, docs, tools, MCPs. No limit.
- 🏳️ **Data Stack Agnostic** — Works with any data warehouse, stack, type of context, LLM.
- 🕵🏻‍♀️ **Agent Reliability Visibility** — Unit test your agent performance before deploying it to users. Version the context and track the performance of your agent over time. Get users feedbacks to improve the agent and track their usage.
- 🔒 **Self-hosted & secure** — Self-host your analytics agent and use your own LLM keys to guarantee maximum security for your data.

For **business users**:

- 🤖 **Natural Language to Insights** — Ask questions in plain English, get analytics straight away
- 📊 **Native Data Visualization** — Create and customize visualizations directly in the chat interface
- 🧊 **Transparent Reasoning** — See the agent reasoning and sources clearly
- 👍 **Easy Feedback** — Send feedback to the data team when a answer is right or wrong

## Quickstart your agent in 1 minute

- **Step 1**: Get the Code

    ```bash
    # Clone the repository
    git clone https://github.com/ianlimle/icai-docs-agent.git
    cd icai-docs-agent

    # Install dependencies
    npm install

    # Start PostgreSQL using Docker Compose
    docker-compose -f docker-compose.postgres.yml up -d

    # Generate database migration files
    cd apps/backend && npm run db:generate

    # Apply migration files to set up the database schema
    npm run db:push

    # Return to the project root
    cd ../..

    # Follow the development setup in CONTRIBUTING.md
    ```

    > **Note**: The database migrations set up all required tables including users, projects, chats, messages, and more. PostgreSQL runs on port 8888 to avoid conflicts with local PostgreSQL instances.

<br/>

- **Step 2**: Sign In
    - Use Google OAuth or email to sign in
    - Create your account

<br/>

- **Step 3**: Create Your First Project
    - Navigate to **Settings > Projects**
    - Click **+ New Project**
    - Enter a project name (e.g., "Analytics Dashboard")
    - Click **Create & Setup Project**

    This will automatically create a project directory and open the workflow setup.

<br/>

- **Step 4**: Complete the Workflow Setup

    The workflow has 3 steps to configure your agent:
    1. **Initialize Project**
        - Optionally add databases (PostgreSQL, Snowflake, BigQuery, etc.)
        - Optionally add Git repositories for code context
        - Optionally upload documentation files (PDF, MD, TXT, etc.)
        - Optionally add Confluence spaces to sync documentation from your Confluence wiki
            - Enter the Confluence Space URL (e.g., `https://company.atlassian.net/wiki/spaces/TEAM`)
            - Provide your API token (generate at https://id.atlassian.com/manage-profile/security/api-tokens)
            - Enter your Atlassian account email
        - Click **Initialize Project**

    2. **Verify Setup**
        - Validates your configuration
        - Checks database connections
        - Verifies LLM provider settings
        - Click **Verify Setup**

    3. **Synchronize Context**
        - Select which providers to sync (Databases, Repos, Docs, Semantics)
        - Click **Synchronize Context**
        - This populates your project with metadata and documentation:
            - Database schemas → `databases/`
            - Repository code → `repos/`
            - Uploaded docs → `docs/`
            - Confluence pages → `docs/confluence/`
            - Business semantics → `semantics/`

<br/>

- **Step 5**: Start Chatting

    Once all 3 workflow steps are complete, you can start asking questions:
    - "What's our monthly revenue trend?"
    - "Show me the top 10 customers by lifetime value"
    - "How many new users signed up last week?"

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, commands, and guidelines.

## Stack

### Backend

- Fastify: https://fastify.dev/docs/latest/
- Drizzle: https://orm.drizzle.team/docs/get-started
- tRPC router: https://trpc.io/docs/server/routers

### Frontend

- tRPC client: https://trpc.io/docs/client/tanstack-react-query/usage
- Tanstack Query: https://tanstack.com/query/latest/docs/framework/react/overview
- Shadcn: https://ui.shadcn.com/docs/components
