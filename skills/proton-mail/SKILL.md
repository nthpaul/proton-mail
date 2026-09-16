---
name: proton-mail
description: Read-only Proton Mail via Proton Bridge IMAP (list folders, list/search/read messages). Use when the user asks about their Proton personal mail and Bridge is configured. Never invent mail content.
---

# Proton Mail (Bridge IMAP)

## When to use

- User asks to list, search, or read **Proton Mail** messages.
- Bridge IMAP credentials are configured (`PROTON_BRIDGE_USER`, `PROTON_BRIDGE_PASSWORD`).
- **Not** for sending, drafting, or SMTP — v1 is read-only.

## If Bridge is not set up

Run the **setup-proton-bridge** skill first (install Bridge on this host, login,
capture this install's mailbox password, start the daemon, register MCP).

## Prerequisites

- [Proton Bridge](https://proton.me/mail/bridge) running locally with IMAP enabled.
- Bridge mailbox password (not the Proton account password).
- Optional: `PROTON_BRIDGE_HOST` (default `127.0.0.1`), `PROTON_IMAP_PORT` (default `1143`).

## Tools

| Tool | Purpose |
|------|---------|
| `check_auth_status` | Verify Bridge reachability; inbox total/unread or clear error |
| `list_folders` | Mailboxes with total/unread counts |
| `list_emails` | Recent messages in a folder (`folder`, optional `limit`, `unreadOnly`) |
| `search_emails` | Search by from/to/subject/text/since/before |
| `read_email` | Full message by id; default peek (`markAsRead` optional) |

## Message ids

Format: `<folder>:<uid>` — e.g. `INBOX:4821`.

Folder aliases: `inbox` → INBOX, `junk`/`spam` → Spam, `bin`/`trash` → Trash.

## Domain shapes

- **ProtonFolder**: `{ name, path, total, unread }`
- **ProtonMessageSummary**: `{ id, folder, uid, subject, from, to, date, flags, hasAttachments }`
- **ProtonMessage**: summary + `{ bodyText, attachments: [{ filename, size, contentType }] }`

## Rules

1. **Never invent** subjects, bodies, senders, or counts. If Bridge is down or auth fails, report the tool error.
2. Prefer `check_auth_status` when connectivity is unclear.
3. Default to peek reads (`markAsRead: false`) unless the user asks to mark as read.
4. Do not claim send/draft capability — this plugin cannot send mail.
