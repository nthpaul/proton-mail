/**
 * Domain types for Proton Mail Bridge IMAP (documentation + JSDoc shapes).
 *
 * ProtonFolder = { name, path, total, unread }
 * ProtonMessageSummary = { id, folder, uid, subject, from, to, date, flags, hasAttachments }
 * ProtonMessage = ProtonMessageSummary & { bodyText, attachments: [{ filename, size, contentType }] }
 *
 * Message id format: `<folder>:<uid>` e.g. `INBOX:4821`.
 */

/**
 * @typedef {object} ProtonFolder
 * @property {string} name
 * @property {string} path
 * @property {number} total
 * @property {number} unread
 */

/**
 * @typedef {object} ProtonMessageSummary
 * @property {string} id - `<folder>:<uid>`
 * @property {string} folder
 * @property {number} uid
 * @property {string} subject
 * @property {string} from
 * @property {string} to
 * @property {string} date - ISO-ish string from envelope
 * @property {string[]} flags
 * @property {boolean} hasAttachments
 */

/**
 * @typedef {object} ProtonAttachmentMeta
 * @property {string} filename
 * @property {number} size
 * @property {string} contentType
 */

/**
 * @typedef {ProtonMessageSummary & { bodyText: string, attachments: ProtonAttachmentMeta[] }} ProtonMessage
 */

export {};
