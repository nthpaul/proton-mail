# proton-mail

Smallest installable **Agent Plugin** (MCP + one skill) for **Proton Mail** via **Proton Bridge IMAP**.

**v1 = list / search / read only.** No draft, send, or SMTP.

## Grok Bot / Cursor note

Other users can install this plugin, but **Proton has no public third-party REST API**. The MCP talks to **Proton Bridge on localhost** (`127.0.0.1:1143`). Bridge must run wherever the MCP process runs (your machine, or your Grok Bot computer). Use the Bridge-generated **mailbox password**, not your Proton login password.

## Requirements

- Node.js 18+
- [Proton Bridge](https://proton.me/mail/bridge) running with IMAP enabled
- Bridge IMAP username + Bridge-generated mailbox password

## Domain types

```
ProtonFolder = { name, path, total, unread }
ProtonMessageSummary = { id, folder, uid, subject, from, to, date, flags, hasAttachments }
ProtonMessage = ProtonMessageSummary & { bodyText, attachments: [{ filename, size, contentType }] }
```

Message **id**: `<folder>:<uid>` — e.g. `INBOX:4821`.

Folder aliases: `inbox` → `INBOX`, `junk` → `Spam`, `bin` → `Trash`.


## Setup skill (Grok Bot / agents)

For first-time connect on a host, agents should follow
`skills/setup-proton-bridge/SKILL.md`: install Bridge on **this** computer,
secure-input Proton email + login password (+ OTP), capture **this install's**
mailbox password from Bridge `info`, start the noninteractive daemon, then
register the MCP. Never reuse another machine's mailbox password.

## Configure

```bash
cp .env.example .env
# edit .env — never commit secrets
```

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `PROTON_BRIDGE_USER` | yes | — | Usually your Proton address |
| `PROTON_BRIDGE_PASSWORD` | yes | — | Bridge mailbox password |
| `PROTON_BRIDGE_HOST` | no | `127.0.0.1` | Bridge host |
| `PROTON_IMAP_PORT` | no | `1143` | Bridge IMAP port |

> Agent Plugins **1.0.0** has a closed `plugin.json` schema (no top-level `variables`). Required secrets are documented here, in `.env.example`, and under `extensions.com.tinkabot.proton-mail.variables` in `plugin.json`. `mcp.json` references `${PROTON_BRIDGE_*}` placeholders — set real values in the host environment (never in the package).

## Install

```bash
cd /path/to/proton-mail
npm install
npm run check
```

## MCP tools

| Tool | Returns |
|------|---------|
| `list_folders` | `ProtonFolder[]` |
| `list_emails({ folder, limit?, unreadOnly? })` | `ProtonMessageSummary[]` |
| `search_emails({ folder?, from?, to?, subject?, text?, since?, before?, limit? })` | `ProtonMessageSummary[]` |
| `read_email({ id, markAsRead? })` | `ProtonMessage` (default peek) |
| `check_auth_status` | `{ reachable, host, port, inbox? }` or clear error if Bridge is down |

## Skill

`skills/proton-mail/SKILL.md` — when to use Bridge mail tools; never invent mail content.

## Layout

```
proton-mail/
├── plugin.json
├── mcp.json
├── package.json
├── README.md
├── .env.example
├── .gitignore
├── assets/
│   └── logo.svg      # listing avatar (Simple Icons Proton Mail, CC0)
├── src/
│   ├── index.js      # stdio MCP server
│   ├── bridge.js     # IMAP helpers (STARTTLS, rejectUnauthorized:false)
│   ├── ids.js        # folder:uid + aliases
│   └── types.js      # JSDoc domain types
├── skills/proton-mail/SKILL.md
├── skills/setup-proton-bridge/SKILL.md
└── test/ids.test.js
```

## Author

Paul / tinkabot — version `0.1.0`.

## Trademark

Proton, Proton Mail, and Proton Mail Bridge are trademarks of Proton AG. This community plugin is not affiliated with or endorsed by Proton AG. The logo in `assets/logo.svg` is the Simple Icons Proton Mail mark (CC0) for identification.
