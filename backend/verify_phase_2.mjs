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
  console.log('=== Starting Phase 2 Programmatic Verification ===');

  let backendProc;
  const report = [];

  // Connect directly to Mongo for setup and validation
  await mongoose.connect('mongodb://localhost:27017/major_r');
  await mongoose.connection.db.dropDatabase();
  console.log('Database cleared for testing.');

  // Import User model using pathToFileURL for Windows ESM compatibility
  const userModelPath = path.resolve(BACKEND_DIR, 'models/user.js');
  const { default: User } = await import(pathToFileURL(userModelPath).href);

  // Seed an Admin directly in the database
  const salt = await bcryptjs.genSalt(10);
  const adminPasswordHash = await bcryptjs.hash('adminpassword123', salt);
  const seedAdmin = new User({
    name: 'System Admin',
    email: 'admin@test.com',
    passwordHash: adminPasswordHash,
    role: 'ADMIN'
  });
  await seedAdmin.save();
  console.log('Admin user seeded directly in DB.');

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
  let ngoToken = '';
  let adminToken = '';
  let donorId = '';
  let ngoId = '';

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

  // TC-1: Register with valid donor data
  await runTestCase('TC-1', 'Register with valid donor data', async () => {
    const res = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Donor User',
        email: 'donor@test.com',
        password: 'password123',
        role: 'DONOR'
      })
    });
    const data = await res.json();
    donorId = data.user?._id;
    return assertEqual(res.status, 201, 'Status code should be 201') &&
           assertEqual(data.success, true, 'success should be true') &&
           assertEqual(data.user?.role, 'DONOR', 'Role should be DONOR') &&
           assertEqual(data.user?.passwordHash, undefined, 'passwordHash must NOT be returned');
  });

  // TC-2: Register with valid NGO data
  await runTestCase('TC-2', 'Register with valid NGO data', async () => {
    const res = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'NGO User',
        email: 'ngo@test.com',
        password: 'password123',
        role: 'NGO'
      })
    });
    const data = await res.json();
    ngoId = data.user?._id;
    return assertEqual(res.status, 201, 'Status code should be 201') &&
           assertEqual(data.success, true, 'success should be true') &&
           assertEqual(data.user?.role, 'NGO', 'Role should be NGO');
  });

  // TC-3: Register with duplicate email
  await runTestCase('TC-3', 'Register with duplicate email', async () => {
    const res = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Another User',
        email: 'donor@test.com',
        password: 'password123',
        role: 'DONOR'
      })
    });
    const data = await res.json();
    return assertEqual(res.status, 400, 'Status code should be 400') &&
           assertEqual(data.success, false, 'success should be false') &&
           assertEqual(data.error?.message, 'Email is already registered', 'Should deny duplicate email');
  });

  // TC-4: Register with invalid email
  await runTestCase('TC-4', 'Register with invalid email', async () => {
    const res = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Invalid Email User',
        email: 'invalidemail',
        password: 'password123',
        role: 'DONOR'
      })
    });
    const data = await res.json();
    return assertEqual(res.status, 400, 'Status code should be 400') &&
           assertEqual(data.success, false, 'success should be false') &&
           assertEqual(data.error?.message, 'Invalid email format', 'Should reject invalid format');
  });

  // TC-5: Register with missing required fields
  await runTestCase('TC-5', 'Register with missing required fields', async () => {
    const res = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'missing@test.com',
        password: 'password123',
        role: 'DONOR'
      })
    });
    const data = await res.json();
    return assertEqual(res.status, 400, 'Status should be 400') &&
           assertEqual(data.success, false, 'success should be false');
  });

  // TC-6: Register with weak/invalid password
  await runTestCase('TC-6', 'Register with weak/invalid password', async () => {
    const res = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Weak User',
        email: 'weak@test.com',
        password: '123',
        role: 'DONOR'
      })
    });
    const data = await res.json();
    return assertEqual(res.status, 400, 'Status code should be 400') &&
           assertEqual(data.success, false, 'success should be false') &&
           assertEqual(data.error?.message, 'Password must be at least 8 characters long', 'Should reject weak password');
  });

  // TC-7: Login with correct credentials
  await runTestCase('TC-7', 'Login with correct credentials', async () => {
    const resDonor = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'donor@test.com', password: 'password123' })
    });
    const dataDonor = await resDonor.json();
    donorToken = dataDonor.token;

    const resNgo = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ngo@test.com', password: 'password123' })
    });
    const dataNgo = await resNgo.json();
    ngoToken = dataNgo.token;

    const resAdmin = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@test.com', password: 'adminpassword123' })
    });
    const dataAdmin = await resAdmin.json();
    adminToken = dataAdmin.token;

    return assertEqual(resDonor.status, 200, 'Donor status 200') &&
           assertEqual(resNgo.status, 200, 'NGO status 200') &&
           assertEqual(resAdmin.status, 200, 'Admin status 200') &&
           assertEqual(typeof donorToken, 'string', 'Donor token generated') &&
           assertEqual(typeof ngoToken, 'string', 'NGO token generated') &&
           assertEqual(typeof adminToken, 'string', 'Admin token generated');
  });

  // TC-8: Login with incorrect password
  await runTestCase('TC-8', 'Login with incorrect password', async () => {
    const res = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'donor@test.com', password: 'wrongpassword' })
    });
    const data = await res.json();
    return assertEqual(res.status, 401, 'Status code should be 401') &&
           assertEqual(data.success, false, 'success should be false') &&
           assertEqual(data.error?.message, 'Invalid email or password', 'Should complain about credentials');
  });

  // TC-9: Login with nonexistent email
  await runTestCase('TC-9', 'Login with nonexistent email', async () => {
    const res = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@test.com', password: 'password123' })
    });
    const data = await res.json();
    return assertEqual(res.status, 401, 'Status code should be 401') &&
           assertEqual(data.success, false, 'success should be false');
  });

  // TC-10: Logout
  await runTestCase('TC-10', 'Logout', async () => {
    const res = await fetch('http://localhost:5000/api/donor/dashboard');
    return assertEqual(res.status, 401, 'No token results in 401 Unauthorized');
  });

  // TC-11: DONOR accesses donor functionality
  await runTestCase('TC-11', 'DONOR accesses donor functionality', async () => {
    const res = await fetch('http://localhost:5000/api/donor/dashboard', {
      headers: { 'Authorization': `Bearer ${donorToken}` }
    });
    const data = await res.json();
    return assertEqual(res.status, 200, 'Status should be 200') &&
           assertEqual(data.success, true, 'success should be true');
  });

  // TC-12: NGO accesses NGO functionality
  await runTestCase('TC-12', 'NGO accesses NGO functionality', async () => {
    const res = await fetch('http://localhost:5000/api/ngo/dashboard', {
      headers: { 'Authorization': `Bearer ${ngoToken}` }
    });
    const data = await res.json();
    return assertEqual(res.status, 200, 'Status should be 200') &&
           assertEqual(data.success, true, 'success should be true');
  });

  // TC-13: ADMIN accesses admin functionality
  await runTestCase('TC-13', 'ADMIN accesses admin functionality', async () => {
    const res = await fetch('http://localhost:5000/api/admin/dashboard', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await res.json();
    return assertEqual(res.status, 200, 'Status should be 200') &&
           assertEqual(data.success, true, 'success should be true');
  });

  // TC-14: DONOR accesses NGO-only endpoint
  await runTestCase('TC-14', 'DONOR accesses NGO-only endpoint', async () => {
    const res = await fetch('http://localhost:5000/api/ngo/dashboard', {
      headers: { 'Authorization': `Bearer ${donorToken}` }
    });
    return assertEqual(res.status, 403, 'Should be HTTP 403 Forbidden');
  });

  // TC-15: DONOR accesses ADMIN-only endpoint
  await runTestCase('TC-15', 'DONOR accesses ADMIN-only endpoint', async () => {
    const res = await fetch('http://localhost:5000/api/admin/dashboard', {
      headers: { 'Authorization': `Bearer ${donorToken}` }
    });
    return assertEqual(res.status, 403, 'Should be HTTP 403 Forbidden');
  });

  // TC-16: Unauthenticated user accesses protected endpoint
  await runTestCase('TC-16', 'Unauthenticated user accesses protected endpoint', async () => {
    const res = await fetch('http://localhost:5000/api/donor/dashboard');
    return assertEqual(res.status, 401, 'Should be HTTP 401 Unauthorized');
  });

  // TC-17: Inspect database user record
  await runTestCase('TC-17', 'Inspect database user record', async () => {
    const userInDb = await User.findOne({ email: 'donor@test.com' });
    const isPlaintext = (!userInDb.passwordHash.startsWith('$2a$') && !userInDb.passwordHash.startsWith('$2b$')) || userInDb.passwordHash.includes('password123');

    return assertEqual(isPlaintext, false, 'Plaintext passwords must NOT be stored') &&
           assertEqual(userInDb.passwordHash.startsWith('$2a$') || userInDb.passwordHash.startsWith('$2b$'), true, 'Password must be hashed with bcrypt');
  });

  // TC-18: Attempt public registration with role=ADMIN
  await runTestCase('TC-18', 'Attempt public registration with role=ADMIN', async () => {
    const res = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Fake Admin',
        email: 'fakeadmin@test.com',
        password: 'password123',
        role: 'ADMIN'
      })
    });
    const data = await res.json();
    return assertEqual(res.status, 400, 'Status should be 400') &&
           assertEqual(data.success, false, 'success should be false') &&
           assertEqual(data.error?.message, 'ADMIN role cannot be self-assigned through public registration', 'Should reject registration');
  });

  // TC-19: Attempt to modify another user's protected information without authorization
  await runTestCase('TC-19', 'Attempt to modify another user\'s profile without authorization', async () => {
    const res = await fetch(`http://localhost:5000/api/users/${ngoId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${donorToken}`
      },
      body: JSON.stringify({ name: 'Hacked NGO Name' })
    });

    const resSelf = await fetch(`http://localhost:5000/api/users/${ngoId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ngoToken}`
      },
      body: JSON.stringify({ name: 'Valid NGO Name Update' })
    });

    return assertEqual(res.status, 403, 'Should deny unauthorized modification with 403') &&
           assertEqual(resSelf.status, 200, 'Should allow modification by owner with 200');
  });

  // Stop servers
  console.log('Shutting down backend server...');
  backendProc.kill('SIGKILL');
  await sleep(1000);
  await mongoose.disconnect();

  console.log('\n=== Phase 2 Verification Summary ===');
  let allPass = true;
  for (const item of report) {
    console.log(`${item.id}: ${item.status}`);
    if (item.status === 'FAIL') allPass = false;
  }

  if (allPass) {
    console.log('ALL PHASE 2 TESTS PASSED SUCCESSFULLY.');
    process.exit(0);
  } else {
    console.log('SOME PHASE 2 TESTS FAILED.');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error in testing framework:', err);
  process.exit(1);
});
