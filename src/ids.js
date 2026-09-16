/** Folder alias map (lowercase key → IMAP mailbox path). */
export const FOLDER_ALIASES = Object.freeze({
  inbox: 'INBOX',
  junk: 'Spam',
  spam: 'Spam',
  bin: 'Trash',
  trash: 'Trash',
  sent: 'Sent',
  drafts: 'Drafts',
  archive: 'Archive',
  all: 'All Mail',
  'all mail': 'All Mail',
  starred: 'Starred',
});

/**
 * Resolve a folder name or alias to a Bridge mailbox path.
 * @param {string} folder
 * @returns {string}
 */
export function resolveFolder(folder) {
  if (folder == null || String(folder).trim() === '') {
    throw new Error('folder is required');
  }
  const raw = String(folder).trim();
  const alias = FOLDER_ALIASES[raw.toLowerCase()];
  return alias ?? raw;
}

/**
 * Format a message id as `<folder>:<uid>`.
 * @param {string} folder
 * @param {number|string} uid
 * @returns {string}
 */
export function formatMessageId(folder, uid) {
  const f = resolveFolder(folder);
  const n = Number(uid);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`invalid uid: ${uid}`);
  }
  return `${f}:${n}`;
}

/**
 * Parse `<folder>:<uid>` (folder may contain colons only if we take last segment as uid).
 * Uses the last `:` as separator so paths are unambiguous for normal Bridge names.
 * @param {string} id
 * @returns {{ folder: string, uid: number }}
 */
export function parseMessageId(id) {
  if (id == null || String(id).trim() === '') {
    throw new Error('message id is required');
  }
  const s = String(id).trim();
  const idx = s.lastIndexOf(':');
  if (idx <= 0 || idx === s.length - 1) {
    throw new Error(`invalid message id (expected <folder>:<uid>): ${id}`);
  }
  const folderPart = s.slice(0, idx);
  const uidPart = s.slice(idx + 1);
  const uid = Number(uidPart);
  if (!Number.isInteger(uid) || uid < 1) {
    throw new Error(`invalid message id uid: ${id}`);
  }
  return { folder: resolveFolder(folderPart), uid };
}
