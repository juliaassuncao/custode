// Focused error-contract checks; no application build, network or credentials.
// node --test src/features/community/tests/communityErrors.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Transpile only this isolated module in memory; no application build or output files.
const source = readFileSync(new URL('../services/communityErrors.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
});
const { CommunityRequestError, responseError } = await import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'));

test('a rejected numbered read reports a loading error, preserving invalid_parameters', () => {
  const error = responseError(400, 'invalid_parameters', null, 'read');
  assert.ok(error instanceof CommunityRequestError);
  assert.equal(error.code, 'invalid_parameters');
  assert.equal(error.message, 'Não foi possível carregar a conversa. Tente novamente.');
});

test('read errors never use publication, report or participation messages', () => {
  for (const code of ['captcha_failed', 'comment_not_found', 'idempotency_conflict', 'rate_limited',
    'private database detail', undefined, null, '__proto__']) {
    const error = responseError(500, code, null, 'read');
    assert.equal(error.message, 'Não foi possível carregar a conversa. Tente novamente.');
    assert.equal(error.code, 'unavailable');
  }
  assert.equal(responseError(401, 'unauthorized', null, 'read').message,
    'Sua sessão não pôde ser confirmada. Tente novamente.');
  assert.equal(responseError(404, 'chapter_not_found', null, 'read').message,
    'A comunidade deste capítulo está indisponível.');
});

test('write validation, proof, retry and uncertain-result contracts are unchanged', () => {
  assert.equal(responseError(400, 'invalid_parameters', null).message,
    'Confira o pseudônimo, o texto e os campos informados.');
  assert.equal(responseError(403, 'captcha_failed', null).message, 'Conclua uma nova verificação de segurança.');
  const limited = responseError(429, 'rate_limited', '30');
  assert.equal(limited.retryAfter, 30);
  assert.equal(limited.message, 'Você chegou ao limite de participações. Aguarde um pouco.');
  assert.equal(limited.uncertain, false);
  assert.equal(responseError(500, 'internal_error', null).uncertain, true);
});
