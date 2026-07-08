import * as Y from 'yjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPersistedYjsState, encodeYjsState } from '../yjsUtils.js';

test('encodeYjsState and applyPersistedYjsState round-trip collaboration state', () => {
  const sourceDoc = new Y.Doc();
  sourceDoc.getText('content').insert(0, 'collab platform');

  const encodedState = encodeYjsState(sourceDoc);

  const restoredDoc = new Y.Doc();
  applyPersistedYjsState(restoredDoc, encodedState);

  assert.equal(restoredDoc.getText('content').toString(), 'collab platform');
});

test('applyPersistedYjsState ignores invalid state and keeps document usable', () => {
  const warnCalls = [];
  const originalWarn = console.warn;
  console.warn = (...args) => {
    warnCalls.push(args);
  };

  try {
    const restoredDoc = new Y.Doc();
    applyPersistedYjsState(restoredDoc, 'not-base64');

    restoredDoc.getText('content').insert(0, 'still works');
    assert.equal(restoredDoc.getText('content').toString(), 'still works');
    assert.equal(warnCalls.length, 1);
  } finally {
    console.warn = originalWarn;
  }
});
