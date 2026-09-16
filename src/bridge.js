import { ImapFlow } from 'imapflow';
import { resolveFolder, formatMessageId, parseMessageId } from './ids.js';

/**
 * @returns {{ host: string, port: number, user: string, pass: string }}
 */
export function getBridgeConfig() {
  const user = process.env.PROTON_BRIDGE_USER || '';
  const pass = process.env.PROTON_BRIDGE_PASSWORD || '';
  const host = process.env.PROTON_BRIDGE_HOST || '127.0.0.1';
  const port = Number(process.env.PROTON_IMAP_PORT || 1143);
  return { host, port, user, pass };
}

/**
 * Connect to Proton Bridge IMAP (STARTTLS; Bridge uses a self-signed cert).
 * @returns {Promise<import('imapflow').ImapFlow>}
 */
export async function connectBridge() {
  const { host, port, user, pass } = getBridgeConfig();
  if (!user || !pass) {
    throw new Error(
      'Missing PROTON_BRIDGE_USER or PROTON_BRIDGE_PASSWORD. Copy .env.example to .env and set Bridge IMAP credentials.'
    );
  }
  const client = new ImapFlow({
    host,
    port,
    secure: false,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    logger: false,
  });
  await client.connect();
  return client;
}

async function withClient(fn) {
  const client = await connectBridge();
  try {
    return await fn(client);
  } finally {
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
  }
}

/**
 * @param {import('imapflow').MessageAddressObject[]|undefined|null} addr
 * @returns {string}
 */
function formatAddress(addr) {
  if (!addr) return '';
  const list = Array.isArray(addr) ? addr : [addr];
  return list
    .map((a) => {
      if (!a) return '';
      if (a.address && a.name) return `${a.name} <${a.address}>`;
      return a.address || a.name || '';
    })
    .filter(Boolean)
    .join(', ');
}

/**
 * @param {import('imapflow').MessageStructureObject|undefined} node
 * @returns {boolean}
 */
function hasAttachmentPart(node) {
  if (!node) return false;
  const disp = (node.disposition || '').toLowerCase();
  if (disp === 'attachment') return true;
  const filename =
    node.dispositionParameters?.filename || node.parameters?.name;
  if (filename && disp !== 'inline') return true;
  if (Array.isArray(node.childNodes)) {
    return node.childNodes.some(hasAttachmentPart);
  }
  return false;
}

/**
 * @param {import('imapflow').MessageStructureObject|undefined} node
 * @param {{ filename: string, size: number, contentType: string }[]} out
 */
function collectAttachments(node, out = []) {
  if (!node) return out;
  const disp = (node.disposition || '').toLowerCase();
  const filename =
    node.dispositionParameters?.filename || node.parameters?.name || null;
  if (filename || disp === 'attachment') {
    out.push({
      filename: filename || 'attachment',
      size: typeof node.size === 'number' ? node.size : 0,
      contentType:
        node.type && node.subtype
          ? `${node.type}/${node.subtype}`
          : 'application/octet-stream',
    });
  }
  if (Array.isArray(node.childNodes)) {
    for (const child of node.childNodes) collectAttachments(child, out);
  }
  return out;
}

/**
 * @param {import('imapflow').FetchMessageObject} msg
 * @param {string} folder
 */
function toSummary(msg, folder) {
  const flags = msg.flags ? [...msg.flags] : [];
  return {
    id: formatMessageId(folder, msg.uid),
    folder,
    uid: msg.uid,
    subject: msg.envelope?.subject || '',
    from: formatAddress(msg.envelope?.from),
    to: formatAddress(msg.envelope?.to),
    date: msg.envelope?.date
      ? new Date(msg.envelope.date).toISOString()
      : '',
    flags,
    hasAttachments: hasAttachmentPart(msg.bodyStructure),
  };
}

const FETCH_FIELDS = {
  uid: true,
  flags: true,
  envelope: true,
  bodyStructure: true,
};

/**
 * @returns {Promise<import('./types.js').ProtonFolder[]>}
 */
export async function listFolders() {
  return withClient(async (client) => {
    const boxes = await client.list();
    /** @type {import('./types.js').ProtonFolder[]} */
    const folders = [];
    for (const box of boxes) {
      if (box.flags?.has('\\Noselect')) continue;
      let total = 0;
      let unread = 0;
      try {
        const status = await client.status(box.path, {
          messages: true,
          unseen: true,
        });
        total = status.messages ?? 0;
        unread = status.unseen ?? 0;
      } catch {
        /* status optional for some folders */
      }
      folders.push({
        name: box.name || box.path,
        path: box.path,
        total,
        unread,
      });
    }
    return folders;
  });
}

/**
 * @param {{ folder: string, limit?: number, unreadOnly?: boolean }} opts
 */
export async function listEmails({ folder, limit = 20, unreadOnly = false }) {
  const path = resolveFolder(folder);
  const cap = Math.min(Math.max(1, Number(limit) || 20), 100);

  return withClient(async (client) => {
    const lock = await client.getMailboxLock(path);
    try {
      const mailbox = client.mailbox;
      if (!mailbox || mailbox.exists === 0) return [];

      /** @type {import('./types.js').ProtonMessageSummary[]} */
      const out = [];

      if (unreadOnly) {
        for await (const msg of client.fetch(
          { seen: false },
          FETCH_FIELDS,
          { uid: true }
        )) {
          out.push(toSummary(msg, path));
          if (out.length >= cap) break;
        }
      } else {
        const exists = mailbox.exists;
        const start = Math.max(1, exists - cap + 1);
        for await (const msg of client.fetch(`${start}:*`, FETCH_FIELDS)) {
          out.push(toSummary(msg, path));
        }
      }

      out.sort((a, b) => b.uid - a.uid);
      return out.slice(0, cap);
    } finally {
      lock.release();
    }
  });
}

/**
 * @param {{
 *   folder?: string,
 *   from?: string,
 *   to?: string,
 *   subject?: string,
 *   text?: string,
 *   since?: string,
 *   before?: string,
 *   limit?: number
 * }} opts
 */
export async function searchEmails(opts = {}) {
  const path = resolveFolder(opts.folder || 'INBOX');
  const cap = Math.min(Math.max(1, Number(opts.limit) || 20), 100);
  /** @type {Record<string, unknown>} */
  const query = {};
  if (opts.from) query.from = opts.from;
  if (opts.to) query.to = opts.to;
  if (opts.subject) query.subject = opts.subject;
  if (opts.text) query.body = opts.text;
  if (opts.since) query.since = new Date(opts.since);
  if (opts.before) query.before = new Date(opts.before);
  if (Object.keys(query).length === 0) query.all = true;

  return withClient(async (client) => {
    const lock = await client.getMailboxLock(path);
    try {
      const uids = await client.search(query, { uid: true });
      if (!uids || uids.length === 0) return [];
      const selected = uids.slice(-cap);
      /** @type {import('./types.js').ProtonMessageSummary[]} */
      const out = [];
      for await (const msg of client.fetch(selected, FETCH_FIELDS, {
        uid: true,
      })) {
        out.push(toSummary(msg, path));
      }
      out.sort((a, b) => b.uid - a.uid);
      return out;
    } finally {
      lock.release();
    }
  });
}

/**
 * Read one message. Default peek (BODY.PEEK / do not set \\Seen).
 * @param {{ id: string, markAsRead?: boolean }} opts
 */
export async function readEmail({ id, markAsRead = false }) {
  const { folder, uid } = parseMessageId(id);

  return withClient(async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      /** @type {import('imapflow').FetchMessageObject|null} */
      let found = null;
      // envelope + structure via peek-friendly fetch
      for await (const msg of client.fetch(
        String(uid),
        {
          ...FETCH_FIELDS,
          source: true,
        },
        { uid: true }
      )) {
        found = msg;
      }
      if (!found) {
        throw new Error(`Message not found: ${id}`);
      }

      let bodyText = '';
      try {
        // imapflow download of a specific part uses BODY.PEEK by default
        const { content } = await client.download(uid, 'TEXT', { uid: true });
        const chunks = [];
        for await (const chunk of content) chunks.push(chunk);
        bodyText = Buffer.concat(chunks).toString('utf8');
      } catch {
        if (found.source) {
          bodyText = found.source.toString('utf8');
        }
      }

      if (markAsRead) {
        await client.messageFlagsAdd({ uid }, ['\\Seen'], { uid: true });
      }

      const summary = toSummary(found, folder);
      return {
        ...summary,
        bodyText: bodyText || '',
        attachments: collectAttachments(found.bodyStructure),
      };
    } finally {
      lock.release();
    }
  });
}

/**
 * @returns {Promise<{ reachable: boolean, host: string, port: number, inbox?: { total: number, unread: number }, error?: string }>}
 */
export async function checkAuthStatus() {
  const { host, port, user, pass } = getBridgeConfig();
  if (!user || !pass) {
    return {
      reachable: false,
      host,
      port,
      error:
        'Missing PROTON_BRIDGE_USER or PROTON_BRIDGE_PASSWORD. Proton Bridge credentials are not configured.',
    };
  }
  try {
    return await withClient(async (client) => {
      const status = await client.status('INBOX', {
        messages: true,
        unseen: true,
      });
      return {
        reachable: true,
        host,
        port,
        inbox: {
          total: status.messages ?? 0,
          unread: status.unseen ?? 0,
        },
      };
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      reachable: false,
      host,
      port,
      error: `Proton Bridge unreachable or auth failed (${host}:${port}): ${message}`,
    };
  }
}
