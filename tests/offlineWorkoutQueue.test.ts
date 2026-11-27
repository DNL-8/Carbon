import assert from 'node:assert/strict';
import { test } from 'node:test';
import { enqueueOfflineWorkout, listOfflineWorkouts } from '../src/utils/offlineWorkoutQueue.ts';

test('fila offline só confirma uma gravação persistida', (t) => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const storage = new Map<string, string>();
  let acceptsWrites = true;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem(key: string, value: string) {
          if (!acceptsWrites) throw new DOMException('Quota excedida', 'QuotaExceededError');
          storage.set(key, value);
        },
      },
    },
  });
  t.after(() => {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  });

  const item = {
    userId: 'user-a',
    workoutId: 'workout-a',
    idempotencyKey: 'key-a',
    completedExercises: 1,
    durationMinutes: 5,
    dateKey: '2026-11-24',
    queuedAt: '2026-11-24T14:00:00Z',
  };

  assert.deepEqual(enqueueOfflineWorkout(item), [item]);
  assert.deepEqual(enqueueOfflineWorkout(item), [item]);
  assert.deepEqual(listOfflineWorkouts('user-b'), []);

  acceptsWrites = false;
  assert.throws(
    () => enqueueOfflineWorkout({ ...item, idempotencyKey: 'key-b' }),
    /Não foi possível salvar o treino/
  );
  assert.deepEqual(listOfflineWorkouts(item.userId), [item]);
});
