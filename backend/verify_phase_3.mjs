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
  console.log('=== Starting Phase 3 Programmatic Verification ===');

  let backendProc;
  const report = [];

  // Connect directly to Mongo for setup and validation
  await mongoose.connect('mongodb://localhost:27017/major_r');
  await mongoose.connection.db.dropDatabase();
  console.log('Database cleared for testing.');

  // Import models
  const userModelPath = path.resolve(BACKEND_DIR, 'models/user.js');
  const { default: User } = await import(pathToFileURL(userModelPath).href);

  const ngoProfileModelPath = path.resolve(BACKEND_DIR, 'models/ngoProfile.js');
  const { default: NgoProfile } = await import(pathToFileURL(ngoProfileModelPath).href);

  const projectModelPath = path.resolve(BACKEND_DIR, 'models/project.js');
  const { default: Project } = await import(pathToFileURL(projectModelPath).href);

  // Seed Users
  const salt = await bcryptjs.genSalt(10);
  const passHash = await bcryptjs.hash('password123', salt);

  const donorUser = new User({ name: 'Donor Test', email: 'donor@test.com', passwordHash: passHash, role: 'DONOR' });
  const ngo1User = new User({ name: 'NGO One', email: 'ngo1@test.com', passwordHash: passHash, role: 'NGO' });
  const ngo2User = new User({ name: 'NGO Two', email: 'ngo2@test.com', passwordHash: passHash, role: 'NGO' });
  const adminUser = new User({ name: 'Admin Test', email: 'admin@test.com', passwordHash: passHash, role: 'ADMIN' });

  await donorUser.save();
  await ngo1User.save();
  await ngo2User.save();
  await adminUser.save();
  console.log('Users seeded successfully in DB.');

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

  let donorToken = '';
  let ngo1Token = '';
  let ngo2Token = '';
  let adminToken = '';
  let ngo1ProfileId = '';
  let validProjectId = '';
  let draftProjectId = '';

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

  // Helper: Login
  const login = async (email) => {
    const res = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' })
    });
    const data = await res.json();
    return data.token;
  };

  // Login all users
  donorToken = await login('donor@test.com');
  ngo1Token = await login('ngo1@test.com');
  ngo2Token = await login('ngo2@test.com');
  adminToken = await login('admin@test.com');

  // Trigger lazy profile creation
  const initProfile = async (token) => {
    const res = await fetch('http://localhost:5000/api/ngo/profile', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    return data.profile._id;
  };
  ngo1ProfileId = await initProfile(ngo1Token);
  await initProfile(ngo2Token);
  console.log('NGO profiles lazily initialized.');

  // TC-1: NGO creates valid project
  await runTestCase('TC-1', 'NGO creates valid project', async () => {
    const res = await fetch('http://localhost:5000/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ngo1Token}`
      },
      body: JSON.stringify({
        title: 'Save the RainForest',
        description: 'Planting trees in the Amazon Basin.',
        targetAmount: 5000,
        startDate: '2026-09-01',
        endDate: '2026-12-31',
        status: 'ACTIVE',
        milestones: [
          { title: 'Seeds purchase', description: 'Buy 500 seeds', amount: 2000, order: 1 },
          { title: 'Planting event', description: 'Hire logistics and plant', amount: 3000, order: 2 }
        ]
      })
    });
    const data = await res.json();
    validProjectId = data.project?._id;

    return assertEqual(res.status, 201, 'Status code should be 201') &&
           assertEqual(data.success, true, 'success should be true') &&
           assertEqual(data.project?.title, 'Save the RainForest', 'Title matches') &&
           assertEqual(data.project?.milestones.length, 2, 'Milestone count is 2');
  });

  // TC-2: NGO creates project with missing title
  await runTestCase('TC-2', 'NGO creates project with missing title', async () => {
    const res = await fetch('http://localhost:5000/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ngo1Token}`
      },
      body: JSON.stringify({
        description: 'No title project Campaign',
        targetAmount: 2000,
        startDate: '2026-09-01',
        endDate: '2026-12-31',
        milestones: [{ title: 'M1', amount: 2000, order: 1 }]
      })
    });
    const data = await res.json();
    return assertEqual(res.status, 400, 'Status should be 400') &&
           assertEqual(data.success, false, 'success should be false') &&
           assertEqual(data.error?.message, 'Project title is required', 'Error logs title requirement');
  });

  // TC-3: NGO creates project with targetAmount <= 0
  await runTestCase('TC-3', 'NGO creates project with targetAmount <= 0', async () => {
    const res = await fetch('http://localhost:5000/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ngo1Token}`
      },
      body: JSON.stringify({
        title: 'Zero Target Project',
        description: 'Planting trees in the Amazon Basin.',
        targetAmount: 0,
        startDate: '2026-09-01',
        endDate: '2026-12-31',
        milestones: [{ title: 'M1', amount: 0, order: 1 }]
      })
    });
    const data = await res.json();
    return assertEqual(res.status, 400, 'Status should be 400') &&
           assertEqual(data.success, false, 'success should be false') &&
           assertEqual(data.error?.message, 'Target amount must be greater than zero', 'Logs validation error');
  });

  // TC-4: NGO creates project with invalid dates
  await runTestCase('TC-4', 'NGO creates project with invalid dates', async () => {
    const res = await fetch('http://localhost:5000/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ngo1Token}`
      },
      body: JSON.stringify({
        title: 'Invalid Dates Project',
        description: 'Campaign with reverse dates',
        targetAmount: 1000,
        startDate: '2026-12-31',
        endDate: '2026-09-01', // End date is before Start date
        milestones: [{ title: 'M1', amount: 1000, order: 1 }]
      })
    });
    const data = await res.json();
    return assertEqual(res.status, 400, 'Status code should be 400') &&
           assertEqual(data.success, false, 'success should be false') &&
           assertEqual(data.error?.message, 'End date must be strictly after the start date', 'Logs date constraints');
  });

  // TC-5: NGO creates project with invalid milestone amounts
  await runTestCase('TC-5', 'NGO creates project with invalid milestone amounts', async () => {
    const res = await fetch('http://localhost:5000/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ngo1Token}`
      },
      body: JSON.stringify({
        title: 'Invalid Milestone Sum Project',
        description: 'Milestones sum up to 1500 but target is 1000',
        targetAmount: 1000,
        startDate: '2026-09-01',
        endDate: '2026-12-31',
        milestones: [
          { title: 'M1', amount: 800, order: 1 },
          { title: 'M2', amount: 700, order: 2 } // Sum = 1500
        ]
      })
    });
    const data = await res.json();
    return assertEqual(res.status, 400, 'Status code should be 400') &&
           assertEqual(data.success, false, 'success should be false') &&
           assertEqual(data.error?.message, 'The sum of milestone amounts must exactly equal the project target amount', 'Logs sum mismatch');
  });

  // TC-6: DONOR attempts to create project
  await runTestCase('TC-6', 'DONOR attempts to create project', async () => {
    const res = await fetch('http://localhost:5000/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${donorToken}`
      },
      body: JSON.stringify({
        title: 'Donor Trying To Create Campaign',
        description: 'Should be rejected',
        targetAmount: 1000,
        startDate: '2026-09-01',
        endDate: '2026-12-31',
        milestones: [{ title: 'M1', amount: 1000, order: 1 }]
      })
    });
    return assertEqual(res.status, 403, 'Should be rejected with HTTP 403 Forbidden');
  });

  // TC-7: NGO attempts to modify another NGO's project
  await runTestCase('TC-7', "NGO attempts to modify another NGO's project", async () => {
    // NGO 2 attempts to modify NGO 1's project (validProjectId)
    const res = await fetch(`http://localhost:5000/api/projects/${validProjectId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ngo2Token}`
      },
      body: JSON.stringify({ title: 'Hacked Title' })
    });
    return assertEqual(res.status, 403, 'Should reject unauthorized modification with HTTP 403');
  });

  // TC-8: DONOR views active project
  await runTestCase('TC-8', 'DONOR views active project', async () => {
    const res = await fetch(`http://localhost:5000/api/projects/${validProjectId}`, {
      headers: { 'Authorization': `Bearer ${donorToken}` }
    });
    const data = await res.json();
    return assertEqual(res.status, 200, 'Status should be 200') &&
           assertEqual(data.project?.title, 'Save the RainForest', 'Details are returned successfully');
  });

  // TC-9: Project with DRAFT status
  await runTestCase('TC-9', 'Project with DRAFT status validation', async () => {
    // First, let NGO 1 create a project in DRAFT status
    const resDraft = await fetch('http://localhost:5000/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ngo1Token}`
      },
      body: JSON.stringify({
        title: 'Draft Campaign',
        description: 'Draft only',
        targetAmount: 1000,
        startDate: '2026-09-01',
        endDate: '2026-12-31',
        status: 'DRAFT',
        milestones: [{ title: 'M1', amount: 1000, order: 1 }]
      })
    });
    const dataDraft = await resDraft.json();
    draftProjectId = dataDraft.project?._id;

    // Fetch active projects and ensure the Draft one is NOT returned
    const resActive = await fetch('http://localhost:5000/api/projects/active');
    const dataActive = await resActive.json();

    const isDraftReturned = dataActive.projects.some(p => p._id === draftProjectId);
    return assertEqual(isDraftReturned, false, 'Draft project must NOT be returned as active');
  });

  // TC-10: ADMIN verifies NGO
  await runTestCase('TC-10', 'ADMIN verifies NGO', async () => {
    const res = await fetch(`http://localhost:5000/api/admin/ngos/${ngo1ProfileId}/verify`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await res.json();
    return assertEqual(res.status, 200, 'Status code should be 200') &&
           assertEqual(data.profile?.verified, true, 'Profile verified flag set to true');
  });

  // TC-11: Unauthorized user attempts admin verification
  await runTestCase('TC-11', 'Unauthorized user attempts admin verification', async () => {
    const res = await fetch(`http://localhost:5000/api/admin/ngos/${ngo1ProfileId}/verify`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${donorToken}` }
    });
    return assertEqual(res.status, 403, 'Unauthorized donor attempts verification, returns HTTP 403');
  });

  // TC-12: Project retrieval returns correct NGO and milestone information
  await runTestCase('TC-12', 'Project retrieval returns correct NGO and milestone info', async () => {
    const res = await fetch(`http://localhost:5000/api/projects/${validProjectId}`);
    const data = await res.json();
    return assertEqual(res.status, 200, 'Status is 200') &&
           assertEqual(data.project?.ngoDetails?.name, 'NGO One', 'NGO Details name is correct') &&
           assertEqual(data.project?.milestones[0]?.title, 'Seeds purchase', 'Milestone title is correct');
  });

  // DATABASE TEST: Verify project and NGO data are persisted correctly in MongoDB
  await runTestCase('DB-TEST', 'Verify persistence in MongoDB directly', async () => {
    const projectInDb = await Project.findById(validProjectId);
    const profileInDb = await NgoProfile.findById(ngo1ProfileId);

    return assertEqual(projectInDb !== null, true, 'Project record found in database') &&
           assertEqual(projectInDb.title, 'Save the RainForest', 'Persisted title matches') &&
           assertEqual(profileInDb !== null, true, 'NGO Profile record found in database') &&
           assertEqual(profileInDb.verified, true, 'Persisted verification flag is true');
  });

  // Shutdown backend process
  console.log('Shutting down backend server...');
  backendProc.kill('SIGKILL');
  await sleep(1000);
  await mongoose.disconnect();

  console.log('\n=== Phase 3 Verification Summary ===');
  let allPass = true;
  for (const item of report) {
    console.log(`${item.id}: ${item.status}`);
    if (item.status === 'FAIL') allPass = false;
  }

  if (allPass) {
    console.log('ALL PHASE 3 TESTS PASSED SUCCESSFULLY.');
    process.exit(0);
  } else {
    console.log('SOME PHASE 3 TESTS FAILED.');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error in testing framework:', err);
  process.exit(1);
});
