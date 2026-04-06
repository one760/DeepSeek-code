# deepseek-code

Interactive coding CLI for DeepSeek with terminal UI, session management, tool calling, retries, cost tracking, and permissioned local actions.

## Version

Current release: `0.1.0`

## Features

- Interactive terminal chat UI with structured panels and command palette
- Session persistence and resume flow
- System prompt and context management
- Native tool calling plus adaptive fallback for reasoner models
- Tool confirmation and permission controls
- Retry handling for transient model failures
- Token and estimated cost tracking
- File, search, edit, shell, git, and MCP extension hooks

## Requirements

- Node.js `>=20`
- A DeepSeek API key

## Install

```bash
npm install
npm run build
```

## Start

Run the interactive app in development:

```bash
npm run dev
```

Run the built CLI:

```bash
npm start
```

## Login

Save your API key before using the assistant:

```bash
deepseek code login
```

## Main Commands

- `/help` show command help
- `/model` switch model
- `/resume` resume a recent session
- `/permissions` inspect or clear permission rules
- `/tools` show tool availability
- `/diff` show the latest diff preview
- `/status` show current session details
- `/usage` show token and cost usage
- `/clear` clear the current conversation
- `/quit` exit the app

## Package Output

To generate the distributable tarball:

```bash
npm pack
```

The output file will be named like `deepseek-code-0.1.0.tgz`.
