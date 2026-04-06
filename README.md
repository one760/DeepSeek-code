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

## Download

This project supports two download methods:

### Option 1: Download the packaged files

Use this if you just want to install and run the CLI quickly without building from source.

Files included in the repository:

- `deepseek-code-0.1.0.tgz`: npm package tarball
- `deepseek-code-0.1.0-package.zip`: zip bundle containing the tarball and install notes
- `INSTALL.md`: short offline install guide

Recommended flow:

1. Download either `deepseek-code-0.1.0-package.zip` or `deepseek-code-0.1.0.tgz`
2. If you downloaded the zip, extract it first
3. Open a terminal in the folder containing the package
4. Install globally:

```bash
npm install -g ./deepseek-code-0.1.0.tgz
```

5. Verify the installation:

```bash
deepseek code version
```

### Option 2: Clone the source code

Use this if you want the full source, want to inspect the code, or want to modify and build it yourself.

1. Clone the repository:

```bash
git clone https://github.com/one760/DeepSeek-code.git
cd DeepSeek-code
```

2. Install dependencies:

```bash
npm install
```

3. Build the CLI:

```bash
npm run build
```

4. Start it:

Development mode:

```bash
npm run dev
```

Built CLI:

```bash
npm start
```

Direct built entry:

```bash
node dist/cli/bin/deepseek.js code
```

## First-time Setup

Save your API key before using the assistant:

```bash
deepseek code login
```

Then launch the CLI:

```bash
deepseek code
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

## Package Files

To regenerate the distributable files locally:

```bash
npm run build
npm pack
```

The npm package output will be named like `deepseek-code-0.1.0.tgz`.

If you also want the zip bundle for sharing, create it after `npm pack`:

```bash
zip -j deepseek-code-0.1.0-package.zip INSTALL.md deepseek-code-0.1.0.tgz
```
