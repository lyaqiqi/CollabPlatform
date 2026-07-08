import test from 'node:test';
import assert from 'node:assert/strict';
import { colorFromUserId } from '../userColor.js';

test('colorFromUserId returns default palette color when user id is empty', () => {
  assert.equal(colorFromUserId(''), '#0075de');
});

test('colorFromUserId returns stable color for the same user id', () => {
  assert.equal(colorFromUserId('user-1'), colorFromUserId('user-1'));
  assert.notEqual(colorFromUserId('user-1'), colorFromUserId('user-2'));
});
