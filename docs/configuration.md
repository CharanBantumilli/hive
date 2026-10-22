# Configuration Guide

Hive is a Python-based agent framework. Configuration is handled through environment variables and agent-level config files. There is no centralized `config.yaml` or Docker Compose setup.

## Configuration Overview

```
~/.hive/configuration.json  (global defaults: provider, model, max_tokens)
Environment variables        (API keys, runtime flags)
Agent config.py              (per-agent settings: model, tools, storage)
pyproject.toml               (package metadata and dependencies)
.mcp.json                    (MCP server connections)
```

## Global Configuration (~/.hive/configuration.json)

The `quickstart.sh` script creates this file during setup. It stores the default LLM provider, model, and max_tokens used by all agents unless overridden in an agent's own `config.py`.

```json
{
  "llm": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 8192,
    "api_key_env_var": "ANTHROPIC_API_KEY"
  },
  "created_at": "2026-01-15T12:00:00+00:00"
}
```

The default `max_tokens` value (8192) is defined as `DEFAULT_MAX_TOKENS` in `framework.orchestrator.edge` and re-exported from `framework.orchestrator`. Each agent's `RuntimeConfig` reads from this file at startup. To change defaults, either re-run `quickstart.sh` or edit the file directly.

Optional packages installed next to Hive are turned on in this file too, under `channels` or
`turn_context`: see [Optional packages](optional-packages.md).

### A queen's own model

Every queen uses the `llm` section unless she has her own under `queen_llm`, by queen id, in the
same shape:

```json
"queen_llm": {
  "queen_archivist": {"provider": "openai", "model": "model-id", "api_base": "https://api.example.com/v1", "api_key": "sk-..."}
}
```

Set it in the dashboard on her profile page (her card in the Org Chart, or her name above her chat → Mind): pick a saved provider,
edit the section, or go back to the main model. Her running chats switch on their next model call,
her context window follows her model, and changing the main model leaves her on hers. The key can
be literal, `api_key_env_var` or in the credential store; the subscription logins (Claude Code,
Codex, Kimi, Antigravity) work only for the main model. Her colony workers use her model too,
unless `worker_llm` is set.

### Fields a provider takes in the request body

`llm`, `worker_llm` and each `queen_llm` entry take `extra_body`: fields sent as they are in every
request body to that model. Use it for what a provider adds to the OpenAI format, such as how
hard the model thinks. For DeepSeek:

```json
"queen_llm": {
  "queen_archivist": {"provider": "openai", "model": "deepseek-flash", "api_base": "https://api.deepseek.com/v1", "api_key": "sk-...",
                      "extra_body": {"reasoning_effort": "low"}}
}
```

`{"thinking": {"type": "disabled"}}` turns DeepSeek's thinking off; `reasoning_effort` takes
`low`, `high` (the default) or `max`. Other providers name these fields differently: see their
documentation. The main model's `extra_body` also goes on its small background calls, such as
recall, so turning thinking off there keeps them fast.

### How often queens write memory

Every few replies a queen reads back the recent conversation and updates her memory files, which
takes a few model calls each time. The `memory_reflection` section sets how often, and on which
model:

```json
"memory_reflection": {"every_turns": 6, "long_every": 4, "model": "main"}
```

| Key | Default | Meaning |
|---|---|---|
| `every_turns` | `6` | Reflect after every this many of her replies |
| `long_every` | `4` | Every this many reflections, also tidy all her memory files (merge and delete duplicates) |
| `model` | `"main"` | `"main"`: the model she talks with. `"worker"`: the `worker_llm` model, or hers if `worker_llm` isn't set. Her dated timeline uses the same model |

A context compaction also tidies her memory, and ending a session reflects once more if anything was
said since the last reflection.

### A queen's soul

Her profile says who she is meant to be and her memory holds what she knows. Her soul is what she has
become: a short, first-person record she writes herself, in sections such as what is on her mind, how she
stands with particular people, what she promised, what she thinks and why, and how she has changed. It rides
her system prompt right after her identity, so it is the same self in every chat.

Once a day, after `hour`, she reads what was said in her chats since the last time and proposes a few changes
in her own voice. Every change must quote, word for word, what she read; sections with `"evidence": 2` need
quotes from two different people or chats; at most `max_edits` changes a day; no section may go over its
`limit` (characters); items in a section with `max_age_days` drop out when they get older than that. In
`"review"` mode the changes wait for you on her profile page (→ Soul), where you approve them
one by one, edit the soul by hand, or restore an earlier version; while a proposal waits, the next reflection
holds off. In `"auto"` mode they apply at once.

```json
"soul": {
  "queens": {
    "queen_archivist": {
      "enabled": true,
      "mode": "review",
      "hour": 4,
      "sources": {"file": "channels/onebot/sessions.json", "keys": ["/group/"]},
      "bootstrap_memories": ["archivist-personality.md"],
      "header": "These are your own notes about yourself. Your identity above comes first.",
      "sections": [
        {"key": "now", "title": "Now", "limit": 300, "max_age_days": 14},
        {"key": "people", "title": "Me and them", "limit": 800, "evidence": 2}
      ]
    }
  }
}
```

| Key | Default | Meaning |
|---|---|---|
| `mode` | `"review"` | `"review"`: changes wait for approval; `"auto"`: they apply at once |
| `hour` | `4` | Local hour after which the daily reflection runs |
| `model` | `"queen"` | `"queen"`: her own model, else the main one; `"worker"`: the `worker_llm` model |
| `max_edits`, `bootstrap_edits` | `5`, `30` | Changes a daily reflection, and the first draft, may make |
| `sources` | none | A channel's chat → session map and patterns for its keys: only those chats are read (here, group chats, not private ones: her soul shows in every chat) |
| `include_titles`, `exclude_titles` | none | Patterns for session titles to read, or to skip |
| `bootstrap_memories` | none | Memory files of hers the first draft reads |
| `sections` | now, people, threads, views, changes | Each `key`, `title`, `limit`, and optionally `max_age_days` and `evidence` |
| `session_chars`, `message_chars` | `12000`, `400` | How much of one chat, and of one message, a reflection reads |

Write the first draft from the dashboard ("Write the first draft"). Everything lives in `queens/<id>/soul/`:
`soul.json` (current), `history/` (every version), `proposals/`, `log.jsonl` and `state.json` (what each chat
was read up to).

To see whether a proposal changes how she sounds, list a few fixed questions in `queens/<id>/soul/probes.json`,
each with an optional anchor (a reply of hers that sounds most like her):
`[{"q": "[Ann(42)]: are you in a good mood today?", "anchor": "..."}]`. "Try her with these changes" on the
waiting proposal answers each one twice on her model, with her soul as it is and as the proposal would make
it, and shows the answers side by side.

## Environment Variables

### LLM Providers (at least one required for real execution)

```bash
# Anthropic (primary provider)
export ANTHROPIC_API_KEY="sk-ant-..."

# OpenAI (optional, for GPT models via LiteLLM)
export OPENAI_API_KEY="sk-..."

# OpenRouter (optional, for OpenRouter-hosted models)
export OPENROUTER_API_KEY="..."

# Hive LLM (optional, for Hive-managed models)
export HIVE_API_KEY="..."

# Cerebras (optional, used by output cleaner and some nodes)
export CEREBRAS_API_KEY="..."

# Groq (optional, fast inference)
export GROQ_API_KEY="..."
```

The framework supports 100+ LLM providers through [LiteLLM](https://docs.litellm.ai/docs/providers). Set the corresponding environment variable for your provider.

### Provider Examples

Native Supported Providers (DeepSeek, Mistral, Together AI, xAI, Perplexity):

```json
{
  "llm": {
    "provider": "deepseek",
    "model": "deepseek-chat",
    "max_tokens": 8192,
    "api_key_env_var": "DEEPSEEK_API_KEY"
  }
}
```

Notes:

- Set `provider` to `deepseek` (or `mistral`, `together`, `xai`, `perplexity`)
- Use the standard model name in `model`, for example `deepseek-chat`
- **No `api_base` is required** for these natively supported providers

OpenRouter:

```json
{
  "llm": {
    "provider": "openrouter",
    "model": "x-ai/grok-4.20-beta",
    "max_tokens": 8192,
    "api_key_env_var": "OPENROUTER_API_KEY",
    "api_base": "https://openrouter.ai/api/v1"
  }
}
```

Notes:

- Set `provider` to `openrouter`
- Use the raw OpenRouter model ID in `model`, for example `x-ai/grok-4.20-beta`
- `api_base` should be `https://openrouter.ai/api/v1`
- If you paste a model that already starts with `openrouter/`, Hive tolerates and normalizes it

Hive LLM:

```json
{
  "llm": {
    "provider": "hive",
    "model": "queen",
    "max_tokens": 32768,
    "api_key_env_var": "HIVE_API_KEY",
    "api_base": "https://api.adenhq.com"
  }
}
```

Notes:

- Set `provider` to `hive`
- Common Hive model values are `queen`, `kimi-k2.6`, `kimi-k2.5`, and `GLM-5`
- Hive LLM requests use the Hive endpoint at `https://api.adenhq.com`

### Search & Tools (optional)

```bash
# Web search for agents (Brave Search)
export BRAVE_SEARCH_API_KEY="..."

# Exa Search (alternative web search)
export EXA_API_KEY="..."
```

### Runtime Flags

```bash
# Run agents without LLM calls (structure-only validation)
export MOCK_MODE=1

# Fernet encryption key for credential store at ~/.hive/credentials
export HIVE_CREDENTIAL_KEY="your-fernet-key"

# Custom agent storage path (default: ~/.hive/agents/{agent_name}/)
export AGENT_STORAGE_PATH="/custom/storage"
```

## Agent Configuration

Each agent package in `exports/` contains its own `config.py`:

```python
# exports/my_agent/config.py
CONFIG = {
    "model": "anthropic/claude-sonnet-4-5-20250929",  # Default LLM model
    "max_tokens": 8192,  # default: DEFAULT_MAX_TOKENS from framework.orchestrator
    "temperature": 0.7,
    "tools": ["web_search", "pdf_read"],   # MCP tools to enable
    "storage_path": "~/.hive/agents/my_agent/",  # Runtime data location (default)
}
```

If `model` or `max_tokens` are omitted, the agent loads defaults from `~/.hive/configuration.json`.

### Standalone agent specification (legacy export format)

> **Scope:** the `nodes`/`edges` `agent.json` format below is the **standalone / exported-agent** format, still supported by the loader for single, exportable agents. It is **not** how the live colony runtime works — a [colony](key_concepts/colony.md) has no graph; the [Queen](key_concepts/queen.md) grows it at runtime and coordinates workers through the shared [tracker](key_concepts/coordination.md#the-tracker). Use this format only when authoring a portable standalone agent.

A standalone agent is defined in `agent.json`:

```json
{
  "id": "my_agent",
  "name": "My Agent",
  "goal": {
    "success_criteria": [...],
    "constraints": [...]
  },
  "nodes": [...],
  "edges": [...]
}
```

See the [Getting Started Guide](getting-started.md) for building agents, and the [Architecture Overview](architecture/README.md) for how colonies actually run.

## MCP Server Configuration

Hive's own tools run in-process and need no configuration (see [Tools](tools.md)); external MCP servers are added with `hive mcp add`. The `.mcp.json` at the project root is separate: it exposes Hive's tool servers to IDE agents such as Claude Code:

```json
{
  "mcpServers": {
    "files-tools": {
      "command": "uv",
      "args": ["run", "files_server.py", "--stdio"],
      "cwd": "tools"
    },
    "tools": {
      "command": "uv",
      "args": ["run", "mcp_server.py", "--stdio"],
      "cwd": "tools"
    }
  }
}
```

The standalone `files-tools` server (`files_server.py`) exposes file I/O (`read_file`, `write_file`, `edit_file`, `search_files`); the `tools` server (`mcp_server.py`) exposes the full `aden_tools` integration catalog. Hive's queens and workers don't use either: they get the same file tools, and a curated subset of the integrations, in-process.

### Servers agents run from the terminal

A server's tools normally load into every agent's tool list, and their schemas are sent with every model call: ComfyUI's official server, [comfy-mcp](https://github.com/Comfy-Org/comfy-mcp), has 39 tools, about 15,600 tokens. Register a server with `--as-cli` instead, and its tools stay out of the tool list. Each agent gets one line naming the server and runs it with `terminal_exec`, through [mcp2cli](https://github.com/knowsuchagency/mcp2cli) by Stephan Fitzpatrick ([@knowsuchagency](https://github.com/knowsuchagency), MIT license), which turns a server's tools into commands:

```bash
hive mcp add --name comfy --transport stdio --as-cli \
  --description "ComfyUI on this PC: run workflows, generate images" \
  --env COMFYUI_URL=http://127.0.0.1:8000 \
  -- uvx --from comfy-mcp --with "comfy-cli>=1.14.0" comfy-mcp

hive mcp run comfy --list                      # its tools, as commands
hive mcp run comfy run-workflow --help         # one command's flags
hive mcp run comfy run-workflow --workflow-path /abs/wf.json --wait
```

Arguments after `--` are the server's command line, so they may start with `-`. Switch an installed server either way with `hive mcp mode <name> cli` or `hive mcp mode <name> tools`, or with **Use from terminal** under Configuration → Skills → MCP Tools → MCP Servers; agents see the change from their next session. A CLI-mode server can use the stdio, SSE or standard MCP HTTP transport, not a unix socket. Its env vars and headers reach the server through the environment, never on the command line, and mcp2cli caches its tool list under `$HIVE_HOME/cache/mcp2cli`.

## Storage

Hive uses **file-based persistence** (no external database required). State lives under `HIVE_HOME`:

```
$HIVE_HOME/
  agents/queens/<queen_id>/     # Queen profiles + sessions
  colonies/<name>/              # one self-contained directory per colony
    worker.json                 #   the colony's worker (clone) spec
    data/tracker.db             #   the colony's shared SQLite ledger
  memories/                     # scoped Queen memory (global / colony / queen)
  credentials/                  # encrypted credential store
```

Each colony is self-contained in its directory, which is what makes it portable (export/import as a tarball). A colony's per-session conversation and cursor state persist under the colony's directory so a crash or restart resumes exactly where it left off.

Storage is managed by `framework.storage.FileStorage`. No external database setup is needed.

## IDE Setup

### VS Code

Add to `.vscode/settings.json`:

```json
{
  "python.analysis.extraPaths": [
    "${workspaceFolder}/core",
    "${workspaceFolder}/exports"
  ]
}
```

### PyCharm

1. Open Project Settings > Project Structure
2. Mark `core` as Sources Root
3. Mark `exports` as Sources Root

## Security Best Practices

1. **Never commit API keys** - Use environment variables or `.env` files
2. **If you use a local `.env` file, keep it private** - This repository does not include a root `.env.example`; use your own local `.env` file or shell environment variables for secrets
3. **Use real provider keys in non-production environments** - validate configuration with low-risk inputs before production rollout
4. **Credential isolation** - Each tool validates its own credentials at runtime

## Troubleshooting

### "ModuleNotFoundError: No module named 'framework'"

Install the core package:

```bash
cd core && uv pip install -e .
```

### API key not found

Ensure the environment variable is set in your current shell session:

```bash
echo $ANTHROPIC_API_KEY  # Or echo $OPENROUTER_API_KEY / echo $HIVE_API_KEY
```

On Windows PowerShell:

```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-..."
# Or:
$env:OPENROUTER_API_KEY = "your-openrouter-key"
$env:HIVE_API_KEY = "your-hive-key"
```

### Agent not found

Run from the project root with PYTHONPATH:

```bash
PYTHONPATH=exports uv run python -m my_agent validate
```

See [Environment Setup](./environment-setup.md) for detailed installation instructions.
