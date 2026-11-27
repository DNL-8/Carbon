import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  clearOfflineUserSnapshot,
  readOfflineUserSnapshot,
  saveOfflineUserSnapshot,
} from '../src/services/authClient.ts';

test('snapshot offline de usuário preserva apenas metadados não sensíveis e limpa no logout', (t) => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
    },
  });
  t.after(() => {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  });

  const userWithExtraSecret = {
    uid: 'cred_abc123',
    email: 'hunter@example.com',
    displayName: 'Hunter',
    image: null,
    emailVerified: true,
    provider: 'credentials',
    apiToken: 'must-never-be-saved',
  };

  saveOfflineUserSnapshot(userWithExtraSecret as never);
  const rawStored = storage.get('hunterfit_offline_user_v1') ?? '';
  assert.equal(rawStored.includes('must-never-be-saved'), false);

  assert.deepEqual(readOfflineUserSnapshot(), {
    uid: 'cred_abc123',
    email: 'hunter@example.com',
    displayName: 'Hunter',
    image: null,
    emailVerified: true,
    provider: 'credentials',
  });

  clearOfflineUserSnapshot();
  assert.equal(readOfflineUserSnapshot(), null);
});
