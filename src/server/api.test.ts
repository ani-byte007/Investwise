import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { createApiApp } from './createApiApp.ts';

async function runApiAndGovernanceTests() {
  const app = createApiApp();
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  try {
    const { port } = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${port}`;

    // 1. /api/health
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const healthBody = (await healthRes.json()) as {
      status: string;
      dataProvider: string;
      firebaseProjectConfigured: boolean;
      paymentWebhookConfigured: boolean;
    };
    assert.equal(healthBody.status, 'ok');
    assert.equal(healthBody.dataProvider, 'nse_reference');
    assert.equal(healthBody.firebaseProjectConfigured, true);
    assert.equal(healthBody.paymentWebhookConfigured, false);

    // 2. /api/market/providers
    const provRes = await fetch(`${baseUrl}/api/market/providers`);
    assert.equal(provRes.status, 200);
    const provBody = (await provRes.json()) as {
      activeAdapter: string;
      providers: Array<{ providerId: string; status: string }>;
    };
    assert.equal(provBody.activeAdapter, 'nse_reference');
    assert.ok(provBody.providers.length >= 2);
    assert.ok(
      provBody.providers.some((p) => p.status === 'pending_commercial_license'),
      'Commercial feeds must remain gated behind pending_commercial_license'
    );

    // 3. /api/market/equities & /api/market/equities/:symbol
    const eqRes = await fetch(`${baseUrl}/api/market/equities`);
    assert.equal(eqRes.status, 200);
    const eqBody = (await eqRes.json()) as { count: number; equities: unknown[] };
    assert.equal(eqBody.count, 10);

    const relianceRes = await fetch(`${baseUrl}/api/market/equities/RELIANCE`);
    assert.equal(relianceRes.status, 200);
    const missingRes = await fetch(`${baseUrl}/api/market/equities/DOESNOTEXIST`);
    assert.equal(missingRes.status, 404);

    // 4. Protected routes require Firebase Bearer token
    const verifyMissing = await fetch(`${baseUrl}/api/auth/verify`);
    assert.equal(verifyMissing.status, 401);

    const verifyInvalid = await fetch(`${baseUrl}/api/auth/verify`, {
      headers: { Authorization: 'Bearer not_a_valid_jwt' },
    });
    assert.equal(verifyInvalid.status, 401);

    const aiUnauth = await fetch(`${baseUrl}/api/research/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: 'RELIANCE' }),
    });
    assert.equal(aiUnauth.status, 401);

    // 5. Webhook verification remains disabled without secret (HTTP 503)
    const webhookRes = await fetch(`${baseUrl}/api/payments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'payment.captured' }),
    });
    assert.equal(webhookRes.status, 503);

    // 6. Calculation verification endpoint
    const calcVerifyRes = await fetch(`${baseUrl}/api/system/verify-calculations`, {
      method: 'POST',
    });
    assert.equal(calcVerifyRes.status, 200);
    const calcVerifyBody = (await calcVerifyRes.json()) as {
      equitiesChecked: number;
      allProvenanceComplete: boolean;
    };
    assert.equal(calcVerifyBody.equitiesChecked, 10);
    assert.equal(calcVerifyBody.allProvenanceComplete, true);

    // 7. Verify Firebase governance files parity (blueprint, rules, indexes, firebase.json)
    const rootDir = process.cwd();
    const blueprint = JSON.parse(
      fs.readFileSync(path.join(rootDir, 'firebase-blueprint.json'), 'utf-8')
    ) as { entities: Record<string, unknown>; firestore: Record<string, unknown> };
    const rules = fs.readFileSync(path.join(rootDir, 'firestore.rules'), 'utf-8');
    const firebaseJson = JSON.parse(
      fs.readFileSync(path.join(rootDir, 'firebase.json'), 'utf-8')
    ) as { firestore: { database: string; rules: string; indexes: string } };

    assert.ok('AuditLog' in blueprint.entities, 'Blueprint must define AuditLog');
    assert.ok(rules.includes('match /auditLogs/{logId}'), 'Rules must define /auditLogs');
    assert.equal(
      firebaseJson.firestore.database,
      'ai-studio-8959177c-4862-419f-89cc-0c51a36e2909'
    );

    console.log('ALL INVESTWISE API & GOVERNANCE INTEGRATION TESTS PASSED');
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

runApiAndGovernanceTests().catch((err) => {
  console.error('API & governance test failed:', err);
  process.exit(1);
});
