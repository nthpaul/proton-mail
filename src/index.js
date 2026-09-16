#!/usr/bin/env node
/**
 * Proton Mail MCP server (stdio) — list / search / read via Proton Bridge IMAP.
 * v1 is read-only: no draft, send, or SMTP.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Load /workspace/proton-mail/.env into process.env if present (does not override existing). */
function loadDotEnv() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadDotEnv();

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  listFolders,
  listEmails,
  searchEmails,
  readEmail,
  checkAuthStatus,
} from './bridge.js';

const server = new McpServer({
  name: 'proton-mail',
  version: '0.1.0',
});

function jsonResult(data) {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(err) {
  const message = err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }],
    isError: true,
  };
}

server.tool(
  'list_folders',
  'List Proton Mail folders/mailboxes via Bridge IMAP, with total and unread counts.',
  {},
  async () => {
    try {
      return jsonResult(await listFolders());
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.tool(
  'list_emails',
  'List recent messages in a folder. Returns ProtonMessageSummary[]. Id format: folder:uid.',
  {
    folder: z
      .string()
      .describe('Mailbox path or alias (inbox, junk, bin, sent, …)'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe('Max messages (default 20)'),
    unreadOnly: z
      .boolean()
      .optional()
      .describe('If true, only unseen messages'),
  },
  async ({ folder, limit, unreadOnly }) => {
    try {
      return jsonResult(
        await listEmails({
          folder,
          limit: limit ?? 20,
          unreadOnly: unreadOnly ?? false,
        })
      );
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.tool(
  'search_emails',
  'Search messages by from/to/subject/text and optional date range. Defaults to INBOX.',
  {
    folder: z.string().optional().describe('Mailbox path or alias (default INBOX)'),
    from: z.string().optional(),
    to: z.string().optional(),
    subject: z.string().optional(),
    text: z.string().optional().describe('Body text search'),
    since: z.string().optional().describe('ISO date or parseable date string'),
    before: z.string().optional().describe('ISO date or parseable date string'),
    limit: z.number().int().min(1).max(100).optional(),
  },
  async (args) => {
    try {
      return jsonResult(await searchEmails(args));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.tool(
  'read_email',
  'Read one message by id (`folder:uid`). Default is peek (does not mark read). Never invent mail content.',
  {
    id: z.string().describe('Message id as folder:uid, e.g. INBOX:4821'),
    markAsRead: z
      .boolean()
      .optional()
      .describe('If true, set \\Seen after read (default false / peek)'),
  },
  async ({ id, markAsRead }) => {
    try {
      return jsonResult(await readEmail({ id, markAsRead: markAsRead ?? false }));
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.tool(
  'check_auth_status',
  'Check whether Proton Bridge IMAP is reachable with configured credentials. Returns inbox counts or a clear error.',
  {},
  async () => {
    try {
      return jsonResult(await checkAuthStatus());
    } catch (err) {
      return errorResult(err);
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
