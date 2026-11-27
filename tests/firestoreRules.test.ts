import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

test('firestore.rules exige verificação de e-mail, propriedade do UID e negação por padrão', () => {
  const rules = readFileSync('firestore.rules', 'utf8');

  assert.match(rules, /rules_version\s*=\s*'2'/);
  assert.match(rules, /match \/\{document=\*\*\}[\s\S]*allow read, write: if false;/);
  assert.match(rules, /function isVerifiedOwner\(userId\)/);
  assert.match(rules, /request\.auth\.uid == userId/);
  assert.match(rules, /request\.auth\.token\.email_verified == true/);

  for (const subcollection of [
    'heroProfiles',
    'gameStats',
    'workouts',
    'workoutLogs',
    'exercisePrs',
    'dailyVows',
    'healthActivities',
    'dailyHealthMetrics',
    'weightLogs',
    'achievements',
    'chatMessages',
    'progressLedger',
  ]) {
    assert.ok(
      rules.includes(`match /${subcollection}/`),
      `Regras devem cobrir a subcoleção ${subcollection}`
    );
  }
});

test('eslint valida firestore.rules sem erros de segurança', () => {
  execFileSync(process.execPath, ['node_modules/eslint/bin/eslint.js', 'firestore.rules'], { stdio: 'pipe' });
});
