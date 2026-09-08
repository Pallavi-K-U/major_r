import { spawn } from 'child_process';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import bcryptjs from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_DIR = path.resolve(__dirname);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function assertEqual(val, expected, msg) {
  if (val === expected) {
    console.log(`  PASS: ${msg}`);
    return true;
  } else {
    console.log(`  FAIL: ${msg} (Expected ${expected}, got ${val})`);
    return false;
  }
}

async function runTests() {
  console.log('=== Starting Phase 4 Programmatic Verification ===');

  let backendProc;
  const report = [];

  // Connect directly to Mongo for setup and validation
  await mongoose.connect('mongodb://localhost:27017/major_r');
  await mongoose.connection.db.dropDatabase();
  console.log('Database cleared for testing.');

  // Import models
  const userModelPath = path.resolve(BACKEND_DIR, 'models/user.js');
  const { default: User } = await import(pathToFileURL(userModelPath).href);

  const projectModelPath = path.resolve(BACKEND_DIR, 'models/project.js');
  const { default: Project } = await import(pathToFileURL(projectModelPath).href);

  const transactionModelPath = path.resolve(BACKEND_DIR, 'models/transaction.js');
  const { default: Transaction } = await import(pathToFileURL(transactionModelPath).href);

  // Seed Users
  const salt = await bcryptjs.genSalt(10);
  const passHash = await bcryptjs.hash('password123', salt);

  const donor1 = new User({ name: 'Donor One', email: 'donor1@test.com', passwordHash: passHash, role: 'DONOR' });
  const donor2 = new User({ name: 'Donor Two', email: 'donor2@test.com', passwordHash: passHash, role: 'DONOR' });
  const ngo1 = new User({ name: 'NGO One', email: 'ngo1@test.com', passwordHash: passHash, role: 'NGO' });
  const ngo2 = new User({ name: 'NGO Two', email: 'ngo2@test.com', passwordHash: passHash, role: 'NGO' });
  const admin = new User({ name: 'Admin User', email: 'admin@test.com', passwordHash: passHash, role: 'ADMIN' });

  await donor1.save();
  await donor2.save();
  await ngo1.save();
  await ngo2.save();
  await admin.save();

  // Seed Projects
  const activeProj1 = new Project({
    title: 'Clean Water Project',
    description: 'Provide clean water to village.',
    ngoId: ngo1._id,
    targetAmount: 10000,
    startDate: '2026-09-01',
    endDate: '2026-12-31',
    status: 'ACTIVE',
    milestones: [{ title: 'Filter purchase', amount: 10000, order: 1 }]
  });

  const draftProj = new Project({
    title: 'Draft Campaign',
    description: 'Unpublished project description.',
    ngoId: ngo1._id,
    targetAmount: 5000,
    startDate: '2026-09-01',
    endDate: '2026-12-31',
    status: 'DRAFT',
    milestones: [{ title: 'Buying seeds', amount: 5000, order: 1 }]
  });

  const activeProj2 = new Project({
    title: 'Food for Homeless',
    description: 'Distribute meals daily.',
    ngoId: ngo2._id,
    targetAmount: 8000,
    startDate: '2026-09-01',
    endDate: '2026-12-31',
    status: 'ACTIVE',
    milestones: [{ title: 'Kitchen supplies', amount: 8000, order: 1 }]
  });

  await activeProj1.save();
  await draftProj.save();
  await activeProj2.save();
  console.log('Database seeded with users and projects.');

  // Start Express backend
  backendProc = spawn('node', ['server.js'], {
    cwd: BACKEND_DIR,
    env: {
      ...process.env,
      PORT: '5000',
      MONGODB_URI: 'mongodb://localhost:27017/major_r',
      JWT_SECRET: 'test_jwt_secret_key_12345678',
      FRONTEND_URL: 'http://localhost:5173'
    }
  });

  let backendOutput = '';
  backendProc.stdout.on('data', (data) => { backendOutput += data.toString(); });
  backendProc.stderr.on('data', (data) => { backendOutput += data.toString(); });

  // Wait for server boot
  await sleep(4000);

  // Retrieve JWT Tokens
  const login = async (email) => {
    const res = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' })
    });
    const data = await res.json();
    return data.token;
  };

  const donor1Token = await login('donor1@test.com');
  const donor2Token = await login('donor2@test.com');
  const ngo1Token = await login('ngo1@test.com');
  const ngo2Token = await login('ngo2@test.com');
  const adminToken = await login('admin@test.com');

  const runTestCase = async (id, desc, fn) => {
    console.log(`\n--- Running ${id}: ${desc} ---`);
    try {
      const outcome = await fn();
      report.push({ id, desc, status: outcome ? 'PASS' : 'FAIL' });
    } catch (err) {
      console.log(`  ERROR: ${err.message}`);
      report.push({ id, desc, status: 'FAIL', notes: err.message });
    }
  };

  let validTxId = '';

  // TC-1: Valid donation of ₹5,000 to active project
  await runTestCase('TC-1', 'Valid donation of 5000 to active project', async () => {
    const res = await fetch('http://localhost:5000/api/donations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${donor1Token}`
      },
      body: JSON.stringify({
        projectId: activeProj1._id,
        amount: 5000,
        idempotencyKey: 'key_tc1_unique_12345'
      })
    });
    const data = await res.json();
    validTxId = data.transaction?._id;

    // Check project raisedAmount
    const updatedProj = await Project.findById(activeProj1._id);

    return assertEqual(res.status, 201, 'Status code is 201') &&
           assertEqual(data.success, true, 'success is true') &&
           assertEqual(data.transaction?.amount, 5000, 'Transaction amount is 5000') &&
           assertEqual(updatedProj.raisedAmount, 5000, 'Project raisedAmount is 5000');
  });

  // TC-2: Donation amount = 0
  await runTestCase('TC-2', 'Donation amount = 0', async () => {
    const res = await fetch('http://localhost:5000/api/donations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${donor1Token}`
      },
      body: JSON.stringify({
        projectId: activeProj1._id,
        amount: 0,
        idempotencyKey: 'key_tc2'
      })
    });
    const data = await res.json();
    return assertEqual(res.status, 400, 'Status code is 400') &&
           assertEqual(data.success, false, 'success is false') &&
           assertEqual(data.error?.message, 'Donation amount must be greater than zero', 'Logs validation error');
  });

  // TC-3: Negative donation
  await runTestCase('TC-3', 'Negative donation', async () => {
    const res = await fetch('http://localhost:5000/api/donations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${donor1Token}`
      },
      body: JSON.stringify({
        projectId: activeProj1._id,
        amount: -100,
        idempotencyKey: 'key_tc3'
      })
    });
    const data = await res.json();
    return assertEqual(res.status, 400, 'Status code is 400') &&
           assertEqual(data.success, false, 'success is false');
  });

  // TC-4: Non-numeric donation
  await runTestCase('TC-4', 'Non-numeric donation', async () => {
    const res = await fetch('http://localhost:5000/api/donations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${donor1Token}`
      },
      body: JSON.stringify({
        projectId: activeProj1._id,
        amount: 'abc',
        idempotencyKey: 'key_tc4'
      })
    });
    const data = await res.json();
    return assertEqual(res.status, 400, 'Status code is 400') &&
           assertEqual(data.success, false, 'success is false') &&
           assertEqual(data.error?.message, 'Donation amount must be a valid numeric value', 'Logs numeric validation error');
  });

  // TC-5: Donation to nonexistent project
  await runTestCase('TC-5', 'Donation to nonexistent project', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await fetch('http://localhost:5000/api/donations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${donor1Token}`
      },
      body: JSON.stringify({
        projectId: fakeId,
        amount: 1000,
        idempotencyKey: 'key_tc5'
      })
    });
    const data = await res.json();
    return assertEqual(res.status, 404, 'Status code should be 404') &&
           assertEqual(data.success, false, 'success is false');
  });

  // TC-6: Donation to DRAFT project
  await runTestCase('TC-6', 'Donation to DRAFT project', async () => {
    const res = await fetch('http://localhost:5000/api/donations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${donor1Token}`
      },
      body: JSON.stringify({
        projectId: draftProj._id,
        amount: 1000,
        idempotencyKey: 'key_tc6'
      })
    });
    const data = await res.json();
    return assertEqual(res.status, 400, 'Status code is 400') &&
           assertEqual(data.success, false, 'success is false') &&
           assertEqual(data.error?.message, 'Donations are only allowed on ACTIVE projects', 'Logs status block');
  });

  // TC-7: Unauthenticated donation
  await runTestCase('TC-7', 'Unauthenticated donation', async () => {
    const res = await fetch('http://localhost:5000/api/donations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: activeProj1._id,
        amount: 1000,
        idempotencyKey: 'key_tc7'
      })
    });
    return assertEqual(res.status, 401, 'Unauthenticated request gets HTTP 401 Unauthorized');
  });

  // TC-8: NGO attempts to access donor-only donation functionality
  await runTestCase('TC-8', 'NGO attempts donation', async () => {
    const res = await fetch('http://localhost:5000/api/donations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ngo1Token}`
      },
      body: JSON.stringify({
        projectId: activeProj1._id,
        amount: 1000,
        idempotencyKey: 'key_tc8'
      })
    });
    return assertEqual(res.status, 403, 'NGO role gets HTTP 403 Forbidden for donor-only endpoints');
  });

  // TC-9: Donor views donation history
  await runTestCase('TC-9', 'Donor views donation history', async () => {
    // Perform a donation from donor 2 to activeProj2
    await fetch('http://localhost:5000/api/donations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${donor2Token}`
      },
      body: JSON.stringify({
        projectId: activeProj2._id,
        amount: 3000,
        idempotencyKey: 'key_donor2_tc9'
      })
    });

    // Fetch Donor 1's history
    const res1 = await fetch('http://localhost:5000/api/donations/my', {
      headers: { 'Authorization': `Bearer ${donor1Token}` }
    });
    const data1 = await res1.json();

    // Verify Donor 1 only gets their own
    const includesDonor2Tx = data1.donations.some(d => d.amount === 3000);

    return assertEqual(res1.status, 200, 'Status is 200') &&
           assertEqual(includesDonor2Tx, false, "Donor 1's history must NOT contain Donor 2's transaction");
  });

  // TC-10: NGO views received donations
  await runTestCase('TC-10', 'NGO views received donations', async () => {
    // NGO 1 queries received donations
    const res = await fetch('http://localhost:5000/api/ngo/donations', {
      headers: { 'Authorization': `Bearer ${ngo1Token}` }
    });
    const data = await res.json();

    // Verify it contains activeProj1's donation (5000) but NOT activeProj2's donation (3000)
    const containsNgo1Donation = data.donations.some(d => d.amount === 5000);
    const containsNgo2Donation = data.donations.some(d => d.amount === 3000);

    return assertEqual(res.status, 200, 'Status is 200') &&
           assertEqual(containsNgo1Donation, true, "Should contain NGO 1's project transaction") &&
           assertEqual(containsNgo2Donation, false, "Should NOT contain NGO 2's project transaction");
  });

  // TC-11: Admin views all transactions
  await runTestCase('TC-11', 'Admin views all transactions', async () => {
    const res = await fetch('http://localhost:5000/api/admin/transactions', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await res.json();

    return assertEqual(res.status, 200, 'Status code is 200') &&
           assertEqual(data.transactions.length >= 2, true, 'Admin can view all records across the system');
  });

  // TC-12: After successful donation, verify: transaction exists, project raisedAmount is correct, donor history contains transaction
  await runTestCase('TC-12', 'Donation consistency post-checks', async () => {
    const tx = await Transaction.findById(validTxId);
    const proj = await Project.findById(activeProj1._id);

    const resHist = await fetch('http://localhost:5000/api/donations/my', {
      headers: { 'Authorization': `Bearer ${donor1Token}` }
    });
    const dataHist = await resHist.json();
    const hasTxInHistory = dataHist.donations.some(d => d._id === validTxId);

    return assertEqual(tx !== null, true, 'Transaction exists in database') &&
           assertEqual(proj.raisedAmount, 5000, 'Project raisedAmount is correct') &&
           assertEqual(hasTxInHistory, true, 'Donor history contains the transaction');
  });

  // TC-13: Attempt duplicate submission caused by rapid repeated requests
  await runTestCase('TC-13', 'Duplicate submission / Idempotency handling', async () => {
    const uniqueKey = 'idemp_key_double_click_test_' + Date.now();

    // Trigger request 1
    const p1 = fetch('http://localhost:5000/api/donations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${donor1Token}`
      },
      body: JSON.stringify({
        projectId: activeProj1._id,
        amount: 1000,
        idempotencyKey: uniqueKey
      })
    });

    // Trigger request 2 simultaneously (simulating double click)
    const p2 = fetch('http://localhost:5000/api/donations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${donor1Token}`
      },
      body: JSON.stringify({
        projectId: activeProj1._id,
        amount: 1000,
        idempotencyKey: uniqueKey
      })
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    const d1 = await r1.json();
    const d2 = await r2.json();

    // Check status codes. One must be 201 (created). The duplicate must be handled safely (either 200 return or success code).
    // In our controller, we check if key exists and return 200 with the existing transaction.
    const isIdempotencySafe = (r1.status === 201 && r2.status === 200) || (r1.status === 200 && r2.status === 201);
    
    // Check database to ensure only one transaction was written (amount raised increments by exactly 1000, not 2000)
    const afterProj = await Project.findById(activeProj1._id);
    const finalRaisedMatches = afterProj.raisedAmount === 6000; // 5000 (validTx) + 1000 (idempotent write)

    return assertEqual(isIdempotencySafe, true, 'Idempotency safety: one create (201) and one retrieve (200) returned') &&
           assertEqual(finalRaisedMatches, true, 'Project raisedAmount incremented only once');
  });

  // Stop servers
  console.log('Shutting down backend server...');
  backendProc.kill('SIGKILL');
  await sleep(1000);
  await mongoose.disconnect();

  console.log('\n=== Phase 4 Verification Summary ===');
  let allPass = true;
  for (const item of report) {
    console.log(`${item.id}: ${item.status}`);
    if (item.status === 'FAIL') allPass = false;
  }

  if (allPass) {
    console.log('ALL PHASE 4 TESTS PASSED SUCCESSFULLY.');
    process.exit(0);
  } else {
    console.log('SOME PHASE 4 TESTS FAILED.');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error in testing framework:', err);
  process.exit(1);
});
