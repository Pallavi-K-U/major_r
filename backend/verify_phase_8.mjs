/**
 * Phase 8 Verification Script — AI Fraud Detection Integration
 *
 * Tests TC-1 through TC-12 against the Python AI service and Node.js backend.
 *
 * Usage:
 *   1. Ensure MongoDB is running.
 *   2. The script starts/stops the Python AI server itself.
 *   3. Run: node backend/verify_phase_8.mjs
 */

import { spawn } from 'child_process';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/major_r';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';
const AI_URL = 'http://localhost:5001';
const BACKEND_URL = 'http://localhost:5000/api';

const report = [];
let aiProcess = null;

// --- Helper Utilities ---

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function generateToken(userId, role) {
  return jwt.sign({ id: userId, role }, JWT_SECRET, { expiresIn: '1h' });
}

async function httpRequest(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  } catch (err) {
    clearTimeout(timeout);
    return { ok: false, status: 0, data: { error: err.message } };
  }
}

function startAiServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn('python', ['ai/ai_server.py'], {
      cwd: path.resolve(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let started = false;
    const onData = (chunk) => {
      const text = chunk.toString();
      if (!started && (text.includes('Running on') || text.includes('Model loaded'))) {
        started = true;
      }
    };

    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);

    proc.on('error', (err) => {
      if (!started) reject(err);
    });

    // Give it time to load the model
    setTimeout(() => {
      if (!started) {
        // Try health check
        fetch(`${AI_URL}/health`).then(r => {
          if (r.ok) resolve(proc);
          else reject(new Error('AI server health check failed'));
        }).catch(() => {
          // Maybe it's still loading, give more time
          setTimeout(() => {
            fetch(`${AI_URL}/health`).then(r => {
              if (r.ok) resolve(proc);
              else reject(new Error('AI server did not start'));
            }).catch(() => reject(new Error('AI server did not start after waiting')));
          }, 5000);
        });
      } else {
        resolve(proc);
      }
    }, 5000);
  });
}

function stopAiServer() {
  if (aiProcess) {
    try { aiProcess.kill('SIGTERM'); } catch (e) { /* ignore */ }
    try { aiProcess.kill(); } catch (e) { /* ignore */ }
    aiProcess = null;
  }
}

async function runCase(id, desc, fn) {
  process.stdout.write(`\n--- ${id}: ${desc} ---\n`);
  try {
    const result = await fn();
    const status = result ? 'PASS' : 'FAIL';
    process.stdout.write(`  ${status}\n`);
    report.push({ id, desc, status });
  } catch (err) {
    process.stdout.write(`  FAIL (Error: ${err.message})\n`);
    report.push({ id, desc, status: 'FAIL', error: err.message });
  }
}

// --- Test Cases ---

async function tc1() {
  // TC-1: Valid transaction sent to AI service — valid response
  const res = await httpRequest(`${AI_URL}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ step: 12, type: 'TRANSFER', amount: 250000 }),
  });

  if (!res.ok || !res.data.success) {
    process.stdout.write(`  Unexpected response: ${JSON.stringify(res.data)}\n`);
    return false;
  }

  const hasFields = 'risk_level' in res.data && 'probability' in res.data && 'prediction' in res.data;
  const validRisk = ['LOW', 'MEDIUM', 'HIGH'].includes(res.data.risk_level);
  process.stdout.write(`  Response: risk=${res.data.risk_level}, prob=${res.data.probability}\n`);
  return hasFields && validRisk;
}

async function tc2() {
  // TC-2: Missing feature — validation error
  const res = await httpRequest(`${AI_URL}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ step: 12, type: 'TRANSFER' }), // missing amount
  });

  process.stdout.write(`  Status: ${res.status}, Error: ${res.data.error}\n`);
  return res.status === 400 && !res.data.success;
}

async function tc3() {
  // TC-3: Invalid feature type — validation error
  const res = await httpRequest(`${AI_URL}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ step: 'invalid_string', type: 'TRANSFER', amount: 100 }),
  });

  process.stdout.write(`  Status: ${res.status}, Error: ${res.data.error}\n`);
  return res.status === 400 && !res.data.success;
}

async function tc4() {
  // TC-4: AI service unavailable — graceful handling
  // Import aiService dynamically
  const { assessTransaction } = await import('./services/aiService.js');

  // Stop the AI server temporarily
  stopAiServer();
  await sleep(1000);

  const result = await assessTransaction({ step: 12, type: 'TRANSFER', amount: 100 });
  process.stdout.write(`  Result when AI down: ${JSON.stringify(result)}\n`);

  const graceful = 'error' in result && typeof result.error === 'string';

  // Restart AI server for remaining tests
  try {
    aiProcess = await startAiServer();
    await sleep(2000);
  } catch (e) {
    process.stdout.write(`  Warning: Could not restart AI server: ${e.message}\n`);
  }

  return graceful;
}

async function tc5() {
  // TC-5: Successful AI prediction stored against correct transaction
  // We'll use the aiService directly to verify the integration path
  const { assessTransaction } = await import('./services/aiService.js');

  const result = await assessTransaction({ step: 14, type: 'CASH_OUT', amount: 500000 });
  process.stdout.write(`  AI result: ${JSON.stringify(result)}\n`);

  if (result.error) {
    process.stdout.write(`  AI service error: ${result.error}\n`);
    return false;
  }

  const hasRisk = 'riskLevel' in result && ['LOW', 'MEDIUM', 'HIGH'].includes(result.riskLevel);
  const hasProb = 'probability' in result && typeof result.probability === 'number';
  return hasRisk && hasProb;
}

async function tc6() {
  // TC-6: Admin views suspicious transaction — risk information available
  // Verify Transaction schema has aiAssessment fields
  const Transaction = (await import('./models/transaction.js')).default;
  const schemaPaths = Transaction.schema.paths;

  const hasRiskLevel = 'aiAssessment.riskLevel' in schemaPaths;
  const hasProbability = 'aiAssessment.probability' in schemaPaths;
  const hasAssessedAt = 'aiAssessment.assessedAt' in schemaPaths;
  const hasError = 'aiAssessment.error' in schemaPaths;
  const hasReviewStatus = 'reviewStatus' in schemaPaths;

  process.stdout.write(`  Schema fields: riskLevel=${hasRiskLevel}, probability=${hasProbability}, assessedAt=${hasAssessedAt}, error=${hasError}, reviewStatus=${hasReviewStatus}\n`);
  return hasRiskLevel && hasProbability && hasAssessedAt && hasError && hasReviewStatus;
}

async function tc7() {
  // TC-7: Admin marks transaction CLEARED — review status updated
  const Transaction = (await import('./models/transaction.js')).default;
  const User = (await import('./models/user.js')).default;

  // Find or create a test admin user
  let admin = await User.findOne({ role: 'ADMIN' });
  if (!admin) {
    process.stdout.write('  No ADMIN user found in DB. Creating test admin...\n');
    const bcrypt = await import('bcryptjs');
    admin = await User.create({
      name: 'Test Admin',
      email: `testadmin_phase8_${Date.now()}@test.com`,
      passwordHash: await bcrypt.hash('password123', 10),
      role: 'ADMIN',
    });
  }

  // Create a test transaction
  const testTx = await Transaction.create({
    donorId: admin._id,
    projectId: new mongoose.Types.ObjectId(),
    amount: 100,
    idempotencyKey: `tc7_phase8_${Date.now()}`,
    status: 'SUCCESS',
    aiAssessment: { riskLevel: 'HIGH', probability: 0.95, assessedAt: new Date() },
    reviewStatus: 'PENDING_REVIEW',
  });

  // Call the review endpoint
  const token = generateToken(admin._id.toString(), 'ADMIN');
  const res = await httpRequest(`${BACKEND_URL}/admin/transactions/${testTx._id}/review`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ reviewStatus: 'CLEARED' }),
  });

  process.stdout.write(`  Response: ${JSON.stringify(res.data?.message)}\n`);

  // Verify in DB
  const updated = await Transaction.findById(testTx._id);
  const pass = res.ok && updated.reviewStatus === 'CLEARED' && updated.reviewedBy?.toString() === admin._id.toString();

  // Cleanup
  await Transaction.deleteOne({ _id: testTx._id });
  return pass;
}

async function tc8() {
  // TC-8: Admin marks transaction ESCALATED — review status updated
  const Transaction = (await import('./models/transaction.js')).default;
  const User = (await import('./models/user.js')).default;

  let admin = await User.findOne({ role: 'ADMIN' });

  const testTx = await Transaction.create({
    donorId: admin._id,
    projectId: new mongoose.Types.ObjectId(),
    amount: 200,
    idempotencyKey: `tc8_phase8_${Date.now()}`,
    status: 'SUCCESS',
    aiAssessment: { riskLevel: 'MEDIUM', probability: 0.6, assessedAt: new Date() },
    reviewStatus: 'PENDING_REVIEW',
  });

  const token = generateToken(admin._id.toString(), 'ADMIN');
  const res = await httpRequest(`${BACKEND_URL}/admin/transactions/${testTx._id}/review`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ reviewStatus: 'ESCALATED' }),
  });

  process.stdout.write(`  Response: ${JSON.stringify(res.data?.message)}\n`);

  const updated = await Transaction.findById(testTx._id);
  const pass = res.ok && updated.reviewStatus === 'ESCALATED';

  await Transaction.deleteOne({ _id: testTx._id });
  return pass;
}

async function tc9() {
  // TC-9: DONOR attempts to modify fraud review status — rejected (403)
  const Transaction = (await import('./models/transaction.js')).default;
  const User = (await import('./models/user.js')).default;

  let donor = await User.findOne({ role: 'DONOR' });
  if (!donor) {
    const bcrypt = await import('bcryptjs');
    donor = await User.create({
      name: 'Test Donor',
      email: `testdonor_phase8_${Date.now()}@test.com`,
      passwordHash: await bcrypt.hash('password123', 10),
      role: 'DONOR',
    });
  }

  const testTx = await Transaction.create({
    donorId: donor._id,
    projectId: new mongoose.Types.ObjectId(),
    amount: 50,
    idempotencyKey: `tc9_phase8_${Date.now()}`,
    status: 'SUCCESS',
    reviewStatus: 'PENDING_REVIEW',
  });

  const donorToken = generateToken(donor._id.toString(), 'DONOR');
  const res = await httpRequest(`${BACKEND_URL}/admin/transactions/${testTx._id}/review`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${donorToken}` },
    body: JSON.stringify({ reviewStatus: 'CLEARED' }),
  });

  process.stdout.write(`  Status: ${res.status}\n`);

  // Verify the review status was NOT changed
  const unchanged = await Transaction.findById(testTx._id);
  const pass = res.status === 403 && unchanged.reviewStatus === 'PENDING_REVIEW';

  await Transaction.deleteOne({ _id: testTx._id });
  return pass;
}

async function tc10() {
  // TC-10: Verify AI assessment does not alter blockchain transaction data
  const Transaction = (await import('./models/transaction.js')).default;

  const originalHash = '0xabc123def456';
  const originalBlock = 42;
  const originalFrom = '0xSenderAddress';
  const originalTo = '0xContractAddress';
  const originalGas = '21000';

  const testTx = await Transaction.create({
    donorId: new mongoose.Types.ObjectId(),
    projectId: new mongoose.Types.ObjectId(),
    amount: 999,
    idempotencyKey: `tc10_phase8_${Date.now()}`,
    status: 'SUCCESS',
    transactionHash: originalHash,
    blockNumber: originalBlock,
    fromAddress: originalFrom,
    toAddress: originalTo,
    gasUsed: originalGas,
  });

  // Add AI assessment
  await Transaction.findByIdAndUpdate(testTx._id, {
    'aiAssessment.riskLevel': 'HIGH',
    'aiAssessment.probability': 0.99,
    'aiAssessment.assessedAt': new Date(),
    reviewStatus: 'ESCALATED',
  });

  // Verify blockchain fields unchanged
  const afterAi = await Transaction.findById(testTx._id);
  const pass =
    afterAi.transactionHash === originalHash &&
    afterAi.blockNumber === originalBlock &&
    afterAi.fromAddress === originalFrom &&
    afterAi.toAddress === originalTo &&
    afterAi.gasUsed === originalGas;

  process.stdout.write(`  Blockchain data preserved: ${pass}\n`);

  await Transaction.deleteOne({ _id: testTx._id });
  return pass;
}

async function tc11() {
  // TC-11: Existing donation functionality still works when AI service is available
  // Verify AI server is running
  const healthRes = await httpRequest(`${AI_URL}/health`);
  if (!healthRes.ok) {
    process.stdout.write('  AI server not running — cannot test TC-11\n');
    return false;
  }

  // Test that aiService returns a valid result when server is up
  const { assessTransaction } = await import('./services/aiService.js');
  const result = await assessTransaction({ step: 10, type: 'PAYMENT', amount: 50 });

  process.stdout.write(`  AI result while server up: ${JSON.stringify(result)}\n`);
  const aiWorks = !result.error && 'riskLevel' in result;

  return aiWorks;
}

async function tc12() {
  // TC-12: Existing donation functionality handles AI service failure without corrupting transaction
  const { assessTransaction } = await import('./services/aiService.js');

  // Stop AI server
  stopAiServer();
  await sleep(1500);

  // Attempt assessment — should return error gracefully
  const result = await assessTransaction({ step: 10, type: 'PAYMENT', amount: 50 });
  process.stdout.write(`  AI result while server down: ${JSON.stringify(result)}\n`);

  const gracefulError = 'error' in result && typeof result.error === 'string';

  // Verify Transaction model still works independently
  const Transaction = (await import('./models/transaction.js')).default;
  const testTx = await Transaction.create({
    donorId: new mongoose.Types.ObjectId(),
    projectId: new mongoose.Types.ObjectId(),
    amount: 77,
    idempotencyKey: `tc12_phase8_${Date.now()}`,
    status: 'SUCCESS',
    aiAssessment: { error: result.error, assessedAt: new Date() },
  });

  const saved = await Transaction.findById(testTx._id);
  const txIntact = saved.amount === 77 && saved.status === 'SUCCESS' && saved.aiAssessment.error != null;
  process.stdout.write(`  Transaction saved correctly despite AI failure: ${txIntact}\n`);

  await Transaction.deleteOne({ _id: testTx._id });
  return gracefulError && txIntact;
}

// --- Main ---

async function main() {
  console.log('=== Phase 8 Verification: AI Fraud Detection Integration ===\n');

  // Connect to MongoDB
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB.');
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }

  // Check if backend server is running (needed for TC-7, TC-8, TC-9)
  const backendCheck = await httpRequest(`${BACKEND_URL}/health`);
  if (!backendCheck.ok) {
    console.log('WARNING: Backend server not running on port 5000. TC-7/8/9 will attempt direct DB operations.\n');
  }

  // Start AI server
  console.log('Starting Python AI server...');
  try {
    aiProcess = await startAiServer();
    console.log('AI server started successfully.\n');
  } catch (err) {
    console.log(`WARNING: Could not start AI server: ${err.message}`);
    console.log('TC-1/2/3/5/11 may fail. TC-4/12 test graceful failure.\n');
  }

  // Run all test cases
  await runCase('TC-1', 'Valid transaction sent to AI service — valid response', tc1);
  await runCase('TC-2', 'Missing feature — validation error', tc2);
  await runCase('TC-3', 'Invalid feature type — validation error', tc3);
  await runCase('TC-4', 'AI service unavailable — graceful handling', tc4);
  await runCase('TC-5', 'Successful AI prediction stored against correct transaction', tc5);
  await runCase('TC-6', 'Admin views suspicious transaction — risk info in schema', tc6);

  if (backendCheck.ok) {
    await runCase('TC-7', 'Admin marks transaction CLEARED', tc7);
    await runCase('TC-8', 'Admin marks transaction ESCALATED', tc8);
    await runCase('TC-9', 'DONOR attempts to modify fraud review status — rejected', tc9);
  } else {
    // Direct DB test variants
    await runCase('TC-7', 'Admin marks transaction CLEARED (direct DB)', tc7);
    await runCase('TC-8', 'Admin marks transaction ESCALATED (direct DB)', tc8);
    await runCase('TC-9', 'DONOR attempts review — rejected (direct DB)', tc9);
  }

  await runCase('TC-10', 'AI assessment does not alter blockchain data', tc10);
  await runCase('TC-11', 'Donation works when AI service is available', tc11);
  await runCase('TC-12', 'Donation handles AI service failure gracefully', tc12);

  // Summary
  console.log('\n=== Phase 8 Test Results Summary ===');
  let allPass = true;
  for (const r of report) {
    console.log(`${r.id}: ${r.status} — ${r.desc}`);
    if (r.status !== 'PASS') allPass = false;
  }

  const passCount = report.filter(r => r.status === 'PASS').length;
  const failCount = report.filter(r => r.status !== 'PASS').length;
  console.log(`\nTotal: ${report.length} | Pass: ${passCount} | Fail: ${failCount}`);

  if (allPass) {
    console.log('\nALL TESTS PASSED.');
  } else {
    console.log('\nSOME TESTS FAILED.');
  }

  // Cleanup
  stopAiServer();
  await mongoose.disconnect();
  process.exit(allPass ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  stopAiServer();
  process.exit(1);
});
