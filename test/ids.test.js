import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatMessageId,
  parseMessageId,
  resolveFolder,
  FOLDER_ALIASES,
} from '../src/ids.js';

describe('resolveFolder aliases', () => {
  it('maps inbox/junk/bin', () => {
    assert.equal(resolveFolder('inbox'), 'INBOX');
    assert.equal(resolveFolder('INBOX'), 'INBOX');
    assert.equal(resolveFolder('junk'), 'Spam');
    assert.equal(resolveFolder('Spam'), 'Spam');
    assert.equal(resolveFolder('bin'), 'Trash');
    assert.equal(resolveFolder('trash'), 'Trash');
  });

  it('passes through unknown paths', () => {
    assert.equal(resolveFolder('Custom/Label'), 'Custom/Label');
  });

  it('exposes expected alias keys', () => {
    assert.ok('inbox' in FOLDER_ALIASES);
    assert.ok('junk' in FOLDER_ALIASES);
    assert.ok('bin' in FOLDER_ALIASES);
  });
});

describe('message ids', () => {
  it('formats folder:uid', () => {
    assert.equal(formatMessageId('inbox', 4821), 'INBOX:4821');
    assert.equal(formatMessageId('Spam', 10), 'Spam:10');
  });

  it('parses folder:uid', () => {
    assert.deepEqual(parseMessageId('INBOX:4821'), { folder: 'INBOX', uid: 4821 });
    assert.deepEqual(parseMessageId('inbox:99'), { folder: 'INBOX', uid: 99 });
  });

  it('rejects invalid ids', () => {
    assert.throws(() => parseMessageId('nocolon'), /invalid message id/);
    assert.throws(() => parseMessageId(':1'), /invalid message id/);
    assert.throws(() => parseMessageId('INBOX:0'), /invalid message id uid/);
    assert.throws(() => formatMessageId('INBOX', -1), /invalid uid/);
  });
});
