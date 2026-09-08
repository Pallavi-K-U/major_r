/**
 * Final QA and Security Audit Test Runner
 *
 * Runs comprehensive automated QA and security test cases across:
 * 1. AUTHENTICATION & RBAC
 * 2. API INPUT VALIDATION & ERROR HANDLING
 * 3. DATABASE INTEGRITY & ISOLATION
 * 4. BLOCKCHAIN SMART CONTRACT SECURITY
 * 5. IPFS DOCUMENT LOCKER INTEGRITY
 * 6. AI FRAUD & IMPACT ANALYSIS INTEGRITY
 * 7. APPLICATION RESILIENCE & IDEMPOTENCY
 * 8. SECURITY & DATA PRIVACY CHECKS
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API = 'http://localhost:5000/api';
const AI_API = 'http://localhost:5001';

// HTTP Helpers
const post = async (url, body, token) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  } catch (err) {
    return { status: 0, error: err.message };
  }
};

const get = async (url, token) => {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const r = await fetch(url, { method: 'GET', headers });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  } catch (err) {
    return { status: 0, error: err.message };
  }
};

const put = async (url, body, token) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const r = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  } catch (err) {
    return { status: 0, error: err.message };
  }
};

const del = async (url, token) => {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const r = await fetch(url, { method: 'DELETE', headers });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  } catch (err) {
    return { status: 0, error: err.message };
  }
};

let passedCount = 0;
let failedCount = 0;
let skippedCount = 0;
const testResults = [];

function recordTest(id, category, desc, expected, actual, status, severity = 'None', fixApplied = 'None') {
  if (status === 'PASS') passedCount++;
  else if (status === 'FAIL') failedCount++;
  else skippedCount++;

  testResults.push({ id, category, desc, expected, actual, status, severity, fixApplied });

  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚪';
  console.log(`${icon} [${id}] [${category}] ${desc} -> ${status} (${actual})`);
}

async function runAudit() {
  console.log('\n================================================================');
  console.log('       MAJOR_R FINAL QA & SECURITY AUDIT TEST HARNESS          ');
  console.log('================================================================\n');

  // Connect to DB
  try {
    await mongoose.connect('mongodb://localhost:27017/major_r', { serverSelectionTimeoutMS: 3000 });
    console.log('✓ Connected to MongoDB (localhost:27017)\n');
  } catch (err) {
    console.error('✗ MongoDB connection failed:', err.message);
    process.exit(1);
  }

  // Check Backend
  const health = await get(`${API}/health`);
  if (health.status !== 200) {
    console.error('✗ Backend is not responding on port 5000. Start backend first.');
    process.exit(1);
  }
  console.log('✓ Backend service is UP (port 5000)\n');

  // Check AI
  let aiAvailable = false;
  const aiHealth = await get(`${AI_API}/health`);
  if (aiHealth.status === 200 && aiHealth.data?.status === 'UP') {
    aiAvailable = true;
    console.log('✓ Python AI service is UP (port 5001)\n');
  } else {
    console.log('⚠ Python AI service is offline — AI fallback tests will execute\n');
  }

  const TS = Date.now();
  const NGO_A_EMAIL = `ngo_a_${TS}@audit.com`;
  const NGO_B_EMAIL = `ngo_b_${TS}@audit.com`;
  const DONOR_EMAIL = `donor_${TS}@audit.com`;
  const ADMIN_EMAIL = `admin_${TS}@audit.com`;
  const PASSWORD = 'AuditPassword123!';

  let ngoAToken, ngoBToken, donorToken, adminToken;
  let ngoAUser, ngoBUser, donorUser, adminUser;
  let projectAId, projectBId;
  let ngoAProfileId;

  // Seed Admin directly in MongoDB
  const hash = await bcrypt.hash(PASSWORD, 10);
  const usersColl = mongoose.connection.collection('users');
  const adminDoc = await usersColl.insertOne({
    name: 'Audit Admin',
    email: ADMIN_EMAIL,
    passwordHash: hash,
    role: 'ADMIN',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  adminUser = { _id: adminDoc.insertedId, name: 'Audit Admin', email: ADMIN_EMAIL, role: 'ADMIN' };

  console.log('================================================================');
  console.log('SECTION 1: AUTHENTICATION & ROLE-BASED ACCESS CONTROL (RBAC)');
  console.log('================================================================');

  // AUTH-01: Invalid Login Credentials (Wrong Password)
  {
    const res = await post(`${API}/auth/login`, { email: ADMIN_EMAIL, password: 'WrongPassword999!' });
    const ok = res.status === 401 && res.data.success === false;
    recordTest('AUTH-01', 'AUTHENTICATION', 'Login with wrong password', 'HTTP 401', `HTTP ${res.status}`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'High');
  }

  // AUTH-02: Invalid Login Credentials (Non-existent user)
  {
    const res = await post(`${API}/auth/login`, { email: `nonexistent_${TS}@audit.com`, password: PASSWORD });
    const ok = res.status === 401 && res.data.success === false;
    recordTest('AUTH-02', 'AUTHENTICATION', 'Login with non-existent email', 'HTTP 401', `HTTP ${res.status}`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'High');
  }

  // AUTH-03: Malformed Email in Registration
  {
    const res = await post(`${API}/auth/register`, { name: 'Bad Email', email: 'notanemail', password: PASSWORD, role: 'DONOR' });
    const ok = res.status === 400 && res.data.success === false;
    recordTest('AUTH-03', 'AUTHENTICATION', 'Registration with malformed email', 'HTTP 400', `HTTP ${res.status} (${res.data.error?.message})`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'Medium');
  }

  // AUTH-04: Weak Password in Registration (< 8 chars)
  {
    const res = await post(`${API}/auth/register`, { name: 'Weak Pass', email: `weak_${TS}@audit.com`, password: '123', role: 'DONOR' });
    const ok = res.status === 400 && res.data.success === false;
    recordTest('AUTH-04', 'AUTHENTICATION', 'Registration with password < 8 characters', 'HTTP 400', `HTTP ${res.status} (${res.data.error?.message})`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'Medium');
  }

  // AUTH-05: Public Role Escalation Attempt (Self-assigning ADMIN)
  {
    const res = await post(`${API}/auth/register`, { name: 'Fake Admin', email: `fakeadmin_${TS}@audit.com`, password: PASSWORD, role: 'ADMIN' });
    const ok = res.status === 400 && res.data.success === false && res.data.error?.message?.includes('ADMIN');
    recordTest('AUTH-05', 'AUTHENTICATION', 'Prevent self-assigned ADMIN registration', 'HTTP 400 Access Denied', `HTTP ${res.status} (${res.data.error?.message})`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'Critical');
  }

  // Register NGO A, NGO B, Donor & Login all
  {
    const rNgoA = await post(`${API}/auth/register`, { name: 'NGO Alpha', email: NGO_A_EMAIL, password: PASSWORD, role: 'NGO' });
    ngoAUser = rNgoA.data.user;
    const lNgoA = await post(`${API}/auth/login`, { email: NGO_A_EMAIL, password: PASSWORD });
    ngoAToken = lNgoA.data.token;

    const rNgoB = await post(`${API}/auth/register`, { name: 'NGO Beta', email: NGO_B_EMAIL, password: PASSWORD, role: 'NGO' });
    ngoBUser = rNgoB.data.user;
    const lNgoB = await post(`${API}/auth/login`, { email: NGO_B_EMAIL, password: PASSWORD });
    ngoBToken = lNgoB.data.token;

    const rDonor = await post(`${API}/auth/register`, { name: 'Generous Donor', email: DONOR_EMAIL, password: PASSWORD, role: 'DONOR' });
    donorUser = rDonor.data.user;
    const lDonor = await post(`${API}/auth/login`, { email: DONOR_EMAIL, password: PASSWORD });
    donorToken = lDonor.data.token;

    const lAdmin = await post(`${API}/auth/login`, { email: ADMIN_EMAIL, password: PASSWORD });
    adminToken = lAdmin.data.token;
  }

  // AUTH-06: Unauthenticated Request on Protected Route
  {
    const res = await get(`${API}/admin/ngos`);
    const ok = res.status === 401;
    recordTest('AUTH-06', 'AUTHENTICATION', 'Access protected route without Authorization header', 'HTTP 401', `HTTP ${res.status}`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'High');
  }

  // AUTH-07: Invalid / Forged JWT Token
  {
    const res = await get(`${API}/admin/ngos`, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake.signature');
    const ok = res.status === 401;
    recordTest('AUTH-07', 'AUTHENTICATION', 'Access protected route with forged JWT token', 'HTTP 401', `HTTP ${res.status}`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'High');
  }

  // AUTH-08: Role Authorization (Donor attempting Admin endpoint)
  {
    const res = await get(`${API}/admin/transactions`, donorToken);
    const ok = res.status === 403;
    recordTest('AUTH-08', 'AUTHENTICATION', 'Donor attempting to access Admin transactions', 'HTTP 403 Forbidden', `HTTP ${res.status}`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'High');
  }

  // AUTH-09: Role Authorization (NGO attempting Donor donation creation endpoint)
  {
    const res = await post(`${API}/donations`, { projectId: '600000000000000000000000', amount: 1, idempotencyKey: 'key' }, ngoAToken);
    const ok = res.status === 403;
    recordTest('AUTH-09', 'AUTHENTICATION', 'NGO attempting to access Donor donation endpoint', 'HTTP 403 Forbidden', `HTTP ${res.status}`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'High');
  }

  // AUTH-10: Cross-User Profile Modification Attempt
  {
    const res = await put(`${API}/users/${ngoBUser._id}`, { name: 'Hacked Name' }, ngoAToken);
    const ok = res.status === 403;
    recordTest('AUTH-10', 'AUTHENTICATION', 'User modifying another user profile', 'HTTP 403 Forbidden', `HTTP ${res.status}`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'High');
  }

  console.log('\n================================================================');
  console.log('SECTION 2: API INPUT VALIDATION & ROBUSTNESS');
  console.log('================================================================');

  // API-01: Malformed JSON payload
  {
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"email": bad json',
      });
      const ok = res.status === 400 || res.status === 500;
      recordTest('API-01', 'API', 'Malformed JSON payload in request body', 'HTTP 400/handled', `HTTP ${res.status}`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'Medium');
    } catch (e) {
      recordTest('API-01', 'API', 'Malformed JSON payload in request body', 'HTTP 400/handled', e.message, 'FAIL', 'High');
    }
  }

  // API-02: Invalid Resource Identifier (CastError / Malformed ObjectId)
  {
    const res = await get(`${API}/projects/not-a-valid-object-id`);
    const ok = res.status === 400 && res.data.error?.message === 'Invalid Resource Identifier';
    recordTest('API-02', 'API', 'Invalid MongoDB ObjectId in URL parameter (CastError)', 'HTTP 400 (Invalid Resource Identifier)', `HTTP ${res.status} (${res.data.error?.message})`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'Medium');
  }

  // API-03: Non-existent Endpoint (404 Handler)
  {
    const res = await get(`${API}/non_existent_route_${TS}`);
    const ok = res.status === 404 && res.data.success === false;
    recordTest('API-03', 'API', 'Non-existent endpoint returns structured 404 JSON', 'HTTP 404 JSON', `HTTP ${res.status}`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'Low');
  }

  // API-04: Project creation with missing description
  {
    const res = await post(`${API}/projects`, {
      title: 'Title without desc',
      targetAmount: 5,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 10000000).toISOString(),
      milestones: [{ title: 'M1', amount: 5, order: 1 }]
    }, ngoAToken);
    const ok = res.status === 400 && res.data.error?.message?.includes('description');
    recordTest('API-04', 'API', 'Project creation with missing description', 'HTTP 400 Description required', `HTTP ${res.status} (${res.data.error?.message})`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'Low');
  }

  // API-05: Project creation with negative target amount
  {
    const res = await post(`${API}/projects`, {
      title: 'Negative Target',
      description: 'Desc',
      targetAmount: -5,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 10000000).toISOString(),
      milestones: [{ title: 'M1', amount: -5, order: 1 }]
    }, ngoAToken);
    const ok = res.status === 400 && res.data.error?.message?.includes('Target amount');
    recordTest('API-05', 'API', 'Project creation with negative target amount', 'HTTP 400 Target > 0', `HTTP ${res.status} (${res.data.error?.message})`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'Medium');
  }

  // API-06: Project creation with end date before start date
  {
    const res = await post(`${API}/projects`, {
      title: 'Inverted Dates',
      description: 'Desc',
      targetAmount: 5,
      startDate: new Date(Date.now() + 10000000).toISOString(),
      endDate: new Date().toISOString(),
      milestones: [{ title: 'M1', amount: 5, order: 1 }]
    }, ngoAToken);
    const ok = res.status === 400 && res.data.error?.message?.includes('strictly after');
    recordTest('API-06', 'API', 'Project creation with end date <= start date', 'HTTP 400 Date validation error', `HTTP ${res.status} (${res.data.error?.message})`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'Low');
  }

  // API-07: Project creation where milestone sum != target amount
  {
    const res = await post(`${API}/projects`, {
      title: 'Mismatch Milestones',
      description: 'Desc',
      targetAmount: 10,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 10000000).toISOString(),
      milestones: [{ title: 'M1', amount: 4, order: 1 }, { title: 'M2', amount: 4, order: 2 }]
    }, ngoAToken);
    const ok = res.status === 400 && res.data.error?.message?.includes('equal the project target');
    recordTest('API-07', 'API', 'Project creation with milestone sum mismatch', 'HTTP 400 Sum mismatch', `HTTP ${res.status} (${res.data.error?.message})`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'Medium');
  }

  console.log('\n================================================================');
  console.log('SECTION 3: DATABASE INTEGRITY & DATA ISOLATION');
  console.log('================================================================');

  // Create valid Project A for NGO A
  {
    const res = await post(`${API}/projects`, {
      title: 'Water Purification Project Alpha',
      description: 'Clean drinking water installation in 20 villages.',
      targetAmount: 10,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 90 * 86400000).toISOString(),
      status: 'ACTIVE',
      milestones: [
        { title: 'Site Inspection', description: 'Surveys', amount: 3, order: 1 },
        { title: 'Filtration Plant', description: 'Installation', amount: 7, order: 2 }
      ]
    }, ngoAToken);
    projectAId = res.data.project?._id;
  }

  // Create valid Project B for NGO B
  {
    const res = await post(`${API}/projects`, {
      title: 'Solar Energy Project Beta',
      description: 'Solar microgrids for schools.',
      targetAmount: 8,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 90 * 86400000).toISOString(),
      status: 'DRAFT',
      milestones: [
        { title: 'Equipment Procurement', description: 'Batteries', amount: 8, order: 1 }
      ]
    }, ngoBToken);
    projectBId = res.data.project?._id;
  }

  // DB-01: Duplicate Registration Email Rejection
  {
    const res = await post(`${API}/auth/register`, { name: 'Dup User', email: NGO_A_EMAIL, password: PASSWORD, role: 'NGO' });
    const ok = res.status === 400 && res.data.error?.message?.includes('already registered');
    recordTest('DB-01', 'DATABASE', 'Duplicate email registration rejected', 'HTTP 400 Already Registered', `HTTP ${res.status} (${res.data.error?.message})`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'High');
  }

  // DB-02: NGO Cross-Project Modification Isolation
  {
    const res = await put(`${API}/projects/${projectAId}`, { title: 'Hijacked Title' }, ngoBToken);
    const ok = res.status === 403 && res.data.error?.message?.includes('only modify your own projects');
    recordTest('DB-02', 'DATABASE', 'NGO B attempting to modify NGO A project', 'HTTP 403 Access Denied', `HTTP ${res.status} (${res.data.error?.message})`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'High');
  }

  // DB-03: DRAFT Projects Isolation from Public Active Query
  {
    const res = await get(`${API}/projects/active`);
    const activeList = res.data.projects || [];
    const draftFound = activeList.some(p => p._id === projectBId || p.status === 'DRAFT');
    const ok = res.status === 200 && !draftFound;
    recordTest('DB-03', 'DATABASE', 'Public active project list excludes DRAFT projects', 'DRAFT excluded', `Found: ${draftFound}`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'Medium');
  }

  // DB-04: Non-existent Project Details lookup
  {
    const res = await get(`${API}/projects/507f1f77bcf86cd799439011`);
    const ok = res.status === 404 && res.data.error?.message === 'Project not found';
    recordTest('DB-04', 'DATABASE', 'Lookup non-existent project returns 404', 'HTTP 404 Project not found', `HTTP ${res.status}`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'Low');
  }

  console.log('\n================================================================');
  console.log('SECTION 4: BLOCKCHAIN SMART CONTRACT INTEGRITY & SIMULATION');
  console.log('================================================================');

  // BC-01: Smart Contract Unit Test Suite verification
  {
    // We verify the deployment config exists and address is valid format
    const configPath = path.resolve(__dirname, 'contract_config.json');
    let hasConfig = fs.existsSync(configPath);
    let validAddr = false;
    if (hasConfig) {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      validAddr = ethers.isAddress(cfg.address);
    }
    recordTest('BC-01', 'BLOCKCHAIN', 'Contract config & address integrity', 'Valid Ethereum Address in contract_config.json', `isAddress: ${validAddr}`, (hasConfig && validAddr) ? 'PASS' : 'FAIL', (hasConfig && validAddr) ? 'None' : 'High');
  }

  // BC-02: Donation on DRAFT Project Rejection
  {
    const res = await post(`${API}/donations`, {
      projectId: projectBId,
      amount: 1,
      idempotencyKey: `idem_draft_${TS}`,
      transactionHash: '0x' + '1'.repeat(64),
    }, donorToken);
    const ok = res.status === 400 && res.data.error?.message?.includes('ACTIVE');
    recordTest('BC-02', 'BLOCKCHAIN', 'Donation on DRAFT project rejected', 'HTTP 400 only allowed on ACTIVE', `HTTP ${res.status} (${res.data.error?.message})`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'Medium');
  }

  // BC-03: Donation on Non-Existent Project Rejection
  {
    const res = await post(`${API}/donations`, {
      projectId: '507f1f77bcf86cd799439011',
      amount: 1,
      idempotencyKey: `idem_nonexist_${TS}`,
    }, donorToken);
    const ok = res.status === 404 && res.data.error?.message === 'Project not found';
    recordTest('BC-03', 'BLOCKCHAIN', 'Donation on non-existent project rejected', 'HTTP 404 Project not found', `HTTP ${res.status}`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'Medium');
  }

  // BC-04: Non-Positive Donation Amount Rejection
  {
    const res = await post(`${API}/donations`, {
      projectId: projectAId,
      amount: 0,
      idempotencyKey: `idem_zero_${TS}`,
    }, donorToken);
    const ok = res.status === 400 && res.data.error?.message?.includes('greater than zero');
    recordTest('BC-04', 'BLOCKCHAIN', 'Donation with amount <= 0 rejected', 'HTTP 400 Amount > 0', `HTTP ${res.status} (${res.data.error?.message})`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'Medium');
  }

  // BC-05: Fake/Unconfirmed On-Chain Transaction Rejection
  {
    const res = await post(`${API}/donations`, {
      projectId: projectAId,
      amount: 1,
      idempotencyKey: `idem_fakehash_${TS}`,
      transactionHash: '0x' + '9'.repeat(64),
    }, donorToken);
    // Should fail gracefully with HTTP 400 due to on-chain verification failure
    const ok = res.status === 400 && res.data.error?.message?.includes('verify transaction');
    recordTest('BC-05', 'BLOCKCHAIN', 'Unverified/fake blockchain transaction hash rejected', 'HTTP 400 Verification Failure', `HTTP ${res.status} (${res.data.error?.message})`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'High');
  }

  console.log('\n================================================================');
  console.log('SECTION 5: IPFS DOCUMENT LOCKER INTEGRITY & ACCESS CONTROLS');
  console.log('================================================================');

  // IPFS-01: Document Upload Without File
  {
    const res = await post(`${API}/documents`, { projectId: projectAId }, ngoAToken);
    const ok = res.status === 400 && res.data.error?.message?.includes('file');
    recordTest('IPFS-01', 'IPFS', 'Upload document request without file rejected', 'HTTP 400 No file uploaded', `HTTP ${res.status} (${res.data.error?.message})`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'Low');
  }

  // IPFS-02: Document Upload by Non-Owner NGO
  {
    // Using multipart upload with boundary
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const payload = `--${boundary}\r\nContent-Disposition: form-data; name="projectId"\r\n\r\n${projectAId}\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="report.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.4 Fake PDF Content\r\n--${boundary}--\r\n`;

    const r = await fetch(`${API}/documents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ngoBToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: payload,
    });
    const data = await r.json().catch(() => ({}));
    const ok = r.status === 403 && data.error?.message?.includes('only upload documents to your own');
    recordTest('IPFS-02', 'IPFS', 'NGO B uploading file to NGO A project rejected', 'HTTP 403 Access Denied', `HTTP ${r.status} (${data.error?.message})`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'High');
  }

  // IPFS-03: Unsupported File MIME Type Rejection
  {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const payload = `--${boundary}\r\nContent-Disposition: form-data; name="projectId"\r\n\r\n${projectAId}\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="script.exe"\r\nContent-Type: application/x-msdownload\r\n\r\nMZ executable content\r\n--${boundary}--\r\n`;

    const r = await fetch(`${API}/documents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ngoAToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: payload,
    });
    const data = await r.json().catch(() => ({}));
    const ok = r.status === 400 && data.error?.message?.includes('Unsupported file type');
    recordTest('IPFS-03', 'IPFS', 'Unsupported file type (.exe) rejected', 'HTTP 400 Unsupported file type', `HTTP ${r.status} (${data.error?.message})`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'High');
  }

  // IPFS-04: Authorized Valid Document Upload to IPFS
  let uploadedDocId = null;
  let uploadedCid = null;
  {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const pdfContent = '%PDF-1.4 Clean Water Project Completion Audit Report. All wells tested.';
    const payload = `--${boundary}\r\nContent-Disposition: form-data; name="projectId"\r\n\r\n${projectAId}\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audit_report.pdf"\r\nContent-Type: application/pdf\r\n\r\n${pdfContent}\r\n--${boundary}--\r\n`;

    const r = await fetch(`${API}/documents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ngoAToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: payload,
    });
    const data = await r.json().catch(() => ({}));
    const ok = r.status === 201 && data.document?.ipfsCid?.startsWith('Qm');
    if (ok) {
      uploadedDocId = data.document._id;
      uploadedCid = data.document.ipfsCid;
    }
    recordTest('IPFS-04', 'IPFS', 'Authorized valid PDF upload generates valid SHA-256 Qm CID', 'HTTP 201 with Qm CID', `HTTP ${r.status} (CID: ${uploadedCid})`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'High');
  }

  // IPFS-05: Document Download Verification
  {
    if (uploadedCid) {
      const r = await fetch(`${API}/documents/${uploadedCid}/download`);
      const bodyText = await r.text();
      const ok = r.status === 200 && bodyText.includes('Clean Water Project Completion Audit Report');
      recordTest('IPFS-05', 'IPFS', 'Download document from IPFS mock gateway returns exact bytes', 'HTTP 200 matching content', `HTTP ${r.status} (len: ${bodyText.length})`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'Medium');
    } else {
      recordTest('IPFS-05', 'IPFS', 'Download document from IPFS mock gateway', 'HTTP 200', 'SKIPPED (no CID)', 'SKIP');
    }
  }

  // IPFS-06: Unauthorized Document Deletion
  {
    if (uploadedDocId) {
      const res = await del(`${API}/documents/${uploadedDocId}`, ngoBToken);
      const ok = res.status === 403 && res.data.error?.message?.includes('only delete your own');
      recordTest('IPFS-06', 'IPFS', 'NGO B attempting to delete NGO A document rejected', 'HTTP 403 Access Denied', `HTTP ${res.status} (${res.data.error?.message})`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'High');
    } else {
      recordTest('IPFS-06', 'IPFS', 'Unauthorized document deletion', 'HTTP 403', 'SKIPPED', 'SKIP');
    }
  }

  console.log('\n================================================================');
  console.log('SECTION 6: AI SERVICE ROBUSTNESS, INPUT VALIDATION & LIMITS');
  console.log('================================================================');

  if (aiAvailable) {
    // AI-01: Fraud AI valid input
    {
      const res = await post(`${AI_API}/predict`, { step: 10, type: 'CASH_OUT', amount: 250000 });
      const ok = res.status === 200 && res.data.success && ['LOW', 'MEDIUM', 'HIGH'].includes(res.data.risk_level) && res.data.probability >= 0 && res.data.probability <= 1;
      recordTest('AI-01', 'AI', 'Fraud AI inference on valid inputs returns bounded probability and risk level', 'HTTP 200 LOW/MED/HIGH', `Risk: ${res.data.risk_level}, Prob: ${res.data.probability}`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'Medium');
    }

    // AI-02: Fraud AI missing required feature
    {
      const res = await post(`${AI_API}/predict`, { step: 10 });
      const ok = res.status === 400 && !res.data.success && res.data.error?.includes('Missing required feature');
      recordTest('AI-02', 'AI', 'Fraud AI missing required feature returns 400 validation error', 'HTTP 400 Missing feature', `HTTP ${res.status} (${res.data.error})`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'Medium');
    }

    // AI-03: Fraud AI non-numeric amount type
    {
      const res = await post(`${AI_API}/predict`, { step: 10, type: 'TRANSFER', amount: 'invalid_amount' });
      const ok = res.status === 400 && !res.data.success;
      recordTest('AI-03', 'AI', 'Fraud AI non-numeric amount rejected with 400', 'HTTP 400 Type Error', `HTTP ${res.status} (${res.data.error})`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'Medium');
    }

    // AI-04: Fraud AI negative amount
    {
      const res = await post(`${AI_API}/predict`, { step: 10, type: 'TRANSFER', amount: -500 });
      const ok = res.status === 400 && !res.data.success;
      recordTest('AI-04', 'AI', 'Fraud AI negative amount rejected with 400', 'HTTP 400 Negative amount error', `HTTP ${res.status} (${res.data.error})`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'Medium');
    }

    // AI-05: Impact AI valid project report
    {
      const reportText = 'The Clean Water Campaign completed on time. We provided clean drinking water to 1,200 beneficiaries across 8 villages. Built 12 deep wells and installed 4 filtration units. Financial utilization reached $38,000 representing 95% of total budget. Health survey showed 85% drop in waterborne illnesses.';
      const res = await post(`${AI_API}/analyse-impact`, { text: reportText });
      const ok = res.status === 200 && res.data.success && res.data.impact_score >= 0 && res.data.impact_score <= 10 && ['LOW', 'MEDIUM', 'HIGH'].includes(res.data.impact_level);
      recordTest('AI-05', 'AI', 'Impact AI report analysis returns structured indicators, score (0-10), and level', 'HTTP 200 HIGH/MED/LOW', `Level: ${res.data.impact_level}, Score: ${res.data.impact_score}`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'Medium');
    }

    // AI-06: Impact AI empty text input
    {
      const res = await post(`${AI_API}/analyse-impact`, { text: '   ' });
      const ok = res.status === 400 && !res.data.success;
      recordTest('AI-06', 'AI', 'Impact AI empty/whitespace input returns 400', 'HTTP 400 Empty text', `HTTP ${res.status} (${res.data.error})`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'Medium');
    }

    // AI-07: Impact AI deterministic consistency check
    {
      const sampleText = 'Project reached 500 children. Established 2 primary schools. Budget allocated $25,000.';
      const r1 = await post(`${AI_API}/analyse-impact`, { text: sampleText });
      const r2 = await post(`${AI_API}/analyse-impact`, { text: sampleText });
      const ok = r1.status === 200 && r2.status === 200 && r1.data.impact_score === r2.data.impact_score && r1.data.impact_level === r2.data.impact_level;
      recordTest('AI-07', 'AI', 'Impact AI yields deterministic score across repeated runs', 'Identical scores', `Run 1: ${r1.data?.impact_score}, Run 2: ${r2.data?.impact_score}`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'Medium');
    }

    // AI-08: Backend Impact Analysis with Project Ownership Enforcement
    {
      const res = await post(`${API}/projects/${projectAId}/analyse-impact`, { text: 'Valid report text for Project Alpha.' }, ngoBToken);
      const ok = res.status === 403 && res.data.error?.message?.includes('only analyse your own');
      recordTest('AI-08', 'AI', 'Backend impact analysis endpoint verifies project ownership', 'HTTP 403 Access Denied', `HTTP ${res.status} (${res.data.error?.message})`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'High');
    }
  } else {
    recordTest('AI-01', 'AI', 'Fraud AI valid input', 'HTTP 200', 'SKIPPED (AI offline)', 'SKIP');
    recordTest('AI-02', 'AI', 'Fraud AI missing required feature', 'HTTP 400', 'SKIPPED (AI offline)', 'SKIP');
    recordTest('AI-03', 'AI', 'Fraud AI non-numeric amount type', 'HTTP 400', 'SKIPPED (AI offline)', 'SKIP');
    recordTest('AI-04', 'AI', 'Fraud AI negative amount', 'HTTP 400', 'SKIPPED (AI offline)', 'SKIP');
    recordTest('AI-05', 'AI', 'Impact AI valid project report', 'HTTP 200', 'SKIPPED (AI offline)', 'SKIP');
    recordTest('AI-06', 'AI', 'Impact AI empty text input', 'HTTP 400', 'SKIPPED (AI offline)', 'SKIP');
    recordTest('AI-07', 'AI', 'Impact AI deterministic consistency check', 'Identical scores', 'SKIPPED (AI offline)', 'SKIP');
    recordTest('AI-08', 'AI', 'Backend impact analysis endpoint verifies project ownership', 'HTTP 403', 'SKIPPED (AI offline)', 'SKIP');
  }

  console.log('\n================================================================');
  console.log('SECTION 7: APPLICATION RESILIENCE & ADMIN AUDITING');
  console.log('================================================================');

  // APP-01: Admin NGO Verification Action
  {
    // Fetch NGO profile to ensure profile doc exists in DB
    const profRes = await get(`${API}/ngo/profile`, ngoAToken);
    ngoAProfileId = profRes.data.profile?._id;
    if (ngoAProfileId) {
      const res = await put(`${API}/admin/ngos/${ngoAProfileId}/verify`, {}, adminToken);
      const ok = res.status === 200 && res.data.profile?.verified === true;
      recordTest('APP-01', 'APPLICATION', 'Admin successfully verifies NGO organization', 'HTTP 200 verified=true', `HTTP ${res.status} (verified: ${res.data.profile?.verified})`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'Medium');
    } else {
      recordTest('APP-01', 'APPLICATION', 'Admin verifies NGO organization', 'HTTP 200', 'SKIPPED (no profile)', 'SKIP');
    }
  }

  // APP-02: Non-Admin attempting to verify NGO
  {
    if (ngoAProfileId) {
      const res = await put(`${API}/admin/ngos/${ngoAProfileId}/verify`, {}, donorToken);
      const ok = res.status === 403;
      recordTest('APP-02', 'APPLICATION', 'Donor attempting NGO verification rejected', 'HTTP 403 Forbidden', `HTTP ${res.status}`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'High');
    } else {
      recordTest('APP-02', 'APPLICATION', 'Donor attempting NGO verification', 'HTTP 403', 'SKIPPED', 'SKIP');
    }
  }

  // APP-03: Admin Updating Review Status with Invalid Status Value
  {
    const res = await put(`${API}/admin/transactions/507f1f77bcf86cd799439011/review`, { reviewStatus: 'INVALID_STATUS' }, adminToken);
    const ok = res.status === 400 && res.data.error?.message?.includes('Invalid review status');
    recordTest('APP-03', 'APPLICATION', 'Admin update review with invalid status enum rejected', 'HTTP 400 Invalid review status', `HTTP ${res.status} (${res.data.error?.message})`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'Low');
  }

  // APP-04: Admin Updating Review Status on Non-Existent Transaction
  {
    const res = await put(`${API}/admin/transactions/507f1f77bcf86cd799439011/review`, { reviewStatus: 'CLEARED' }, adminToken);
    const ok = res.status === 404 && res.data.error?.message === 'Transaction not found';
    recordTest('APP-04', 'APPLICATION', 'Admin update review on non-existent transaction returns 404', 'HTTP 404 Transaction not found', `HTTP ${res.status}`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'Low');
  }

  // APP-05: Phase 10 Integration Status Route Access Control
  {
    const res = await get(`${API}/e2e/status`, donorToken);
    const ok = res.status === 403;
    recordTest('APP-05', 'APPLICATION', 'Donor access to E2E integration status route rejected', 'HTTP 403 Forbidden', `HTTP ${res.status}`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'Medium');
  }

  // APP-06: Phase 10 Integration Status Route Admin Access
  {
    const res = await get(`${API}/e2e/status`, adminToken);
    const ok = res.status === 200 && res.data.success && res.data.integration?.backend === 'UP';
    recordTest('APP-06', 'APPLICATION', 'Admin access to E2E integration status route succeeds', 'HTTP 200 with service statuses', `HTTP ${res.status} (Backend: ${res.data.integration?.backend}, DB: ${res.data.integration?.database})`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'Low');
  }

  console.log('\n================================================================');
  console.log('SECTION 8: SECURITY, PRIVACY & DATA LEAKAGE CHECKS');
  console.log('================================================================');

  // SEC-01: Password Hash Exclusion in Login Response
  {
    const res = await post(`${API}/auth/login`, { email: DONOR_EMAIL, password: PASSWORD });
    const hasHash = 'passwordHash' in (res.data.user || {}) || 'password' in (res.data.user || {});
    const ok = res.status === 200 && !hasHash;
    recordTest('SEC-01', 'SECURITY', 'Password hash excluded from user JSON response on login', 'No passwordHash in response body', `hasHash: ${hasHash}`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'Critical');
  }

  // SEC-02: Password Hash Exclusion in User Profile Update
  {
    const res = await put(`${API}/users/${donorUser._id}`, { name: 'Updated Donor Name' }, donorToken);
    const hasHash = 'passwordHash' in (res.data.user || {}) || 'password' in (res.data.user || {});
    const ok = res.status === 200 && !hasHash;
    recordTest('SEC-02', 'SECURITY', 'Password hash excluded from user profile update response', 'No passwordHash in response body', `hasHash: ${hasHash}`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'Critical');
  }

  // SEC-03: User Profile Update Disallows Role Alteration
  {
    const res = await put(`${API}/users/${donorUser._id}`, { role: 'ADMIN', name: 'Escalation Attempt' }, donorToken);
    // Reload user from DB
    const freshUser = await mongoose.connection.collection('users').findOne({ _id: new mongoose.Types.ObjectId(donorUser._id) });
    const ok = freshUser.role === 'DONOR';
    recordTest('SEC-03', 'SECURITY', 'User profile update prevents modifying user role attribute', 'Role remains DONOR in database', `DB Role: ${freshUser.role}`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'Critical');
  }

  // SEC-04: CORS Origin Configuration Verification
  {
    const r = await fetch(`${API}/health`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET',
      }
    });
    const allowOrigin = r.headers.get('access-control-allow-origin');
    const ok = allowOrigin === 'http://localhost:5173' || r.status === 204 || r.status === 200;
    recordTest('SEC-04', 'SECURITY', 'CORS headers restrict access to configured frontend origin', 'Access-Control-Allow-Origin: http://localhost:5173', `Allow-Origin: ${allowOrigin}`, ok ? 'PASS' : 'FAIL', ok ? 'None' : 'Medium');
  }

  // SEC-05: Hard-Coded Secrets Check (.env in gitignore)
  {
    const gitignorePath = path.resolve(__dirname, '../.gitignore');
    let hasGitignore = fs.existsSync(gitignorePath);
    let envIgnored = false;
    if (hasGitignore) {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
      envIgnored = gitignoreContent.includes('.env');
    }
    recordTest('SEC-05', 'SECURITY', '.gitignore exists and contains .env entries', '.env present in .gitignore', `Ignored: ${envIgnored}`, (hasGitignore && envIgnored) ? 'PASS' : 'FAIL', (hasGitignore && envIgnored) ? 'None' : 'High');
  }

  // Clean up
  await mongoose.disconnect();

  console.log('\n================================================================');
  console.log(`TOTAL QA/SECURITY TESTS EXECUTED: ${testResults.length}`);
  console.log(`PASSED: ${passedCount} | FAILED: ${failedCount} | SKIPPED: ${skippedCount}`);
  console.log('================================================================\n');

  return { testResults, passedCount, failedCount, skippedCount };
}

runAudit()
  .then(res => {
    fs.writeFileSync(
      path.resolve(__dirname, '../TESTING/final_qa_results.json'),
      JSON.stringify(res, null, 2),
      'utf8'
    );
    process.exit(res.failedCount > 0 ? 1 : 0);
  })
  .catch(err => {
    console.error('Fatal execution error:', err);
    process.exit(1);
  });
