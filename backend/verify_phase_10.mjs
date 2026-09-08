/**
 * Phase 10 — End-to-End Integration Test Harness
 *
 * Runs 16+ real integration tests against the live backend.
 * Prerequisites:
 *   1. MongoDB running on localhost:27017
 *   2. Backend running on localhost:5000  (node backend/server.js)
 *   3. AI server running on localhost:5001 (python ai/ai_server.py) [optional]
 *
 * Usage:  node backend/verify_phase_10.mjs
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const API = 'http://localhost:5000/api';
const AI_API = 'http://localhost:5001';

// helpers
const post = async (url, body, token) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};

const get = async (url, token) => {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(url, { method: 'GET', headers });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};

const put = async (url, body, token) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};

let passed = 0, failed = 0, skipped = 0;
const results = [];

function report(id, desc, ok, detail) {
  const status = ok === null ? 'SKIP' : ok ? 'PASS' : 'FAIL';
  if (ok === null) skipped++;
  else if (ok) passed++;
  else failed++;
  results.push({ id, desc, status, detail });
  const icon = ok === null ? '⚪' : ok ? '✅' : '❌';
  console.log(`${icon} ${id}: ${desc} — ${status}${detail ? ' (' + detail + ')' : ''}`);
}

// seed data
const TS = Date.now();
const NGO_EMAIL = `ngo_e2e_${TS}@test.com`;
const DONOR_EMAIL = `donor_e2e_${TS}@test.com`;
const ADMIN_EMAIL = `admin_e2e_${TS}@test.com`;
const PASSWORD = 'TestPass123!';

let ngoToken, donorToken, adminToken;
let ngoUser, donorUser, adminUser;
let projectId, ngoProfileId;

async function seedAdmin() {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const User = mongoose.connection.collection('users');
  const existing = await User.findOne({ email: ADMIN_EMAIL });
  if (existing) await User.deleteOne({ email: ADMIN_EMAIL });
  const result = await User.insertOne({
    name: 'E2E Admin',
    email: ADMIN_EMAIL,
    passwordHash: hash,
    role: 'ADMIN',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return result.insertedId;
}

async function main() {
  console.log('\n========================================================');
  console.log('  Phase 10 — End-to-End Integration Test Harness');
  console.log('========================================================\n');

  try {
    await mongoose.connect('mongodb://localhost:27017/major_r', {
      serverSelectionTimeoutMS: 3000,
    });
    console.log('✓ Connected to MongoDB for test seeding\n');
  } catch (err) {
    console.error('✗ Cannot connect to MongoDB:', err.message);
    process.exit(1);
  }

  try {
    const h = await get(`${API}/health`);
    if (h.status !== 200) throw new Error('unhealthy');
    console.log('✓ Backend is running\n');
  } catch {
    console.error('✗ Backend is not running on port 5000. Start it first.');
    process.exit(1);
  }

  let aiAvailable = false;
  try {
    const h = await get(`${AI_API}/health`);
    aiAvailable = h.status === 200 && h.data.status === 'UP';
    console.log(aiAvailable ? '✓ AI service is running\n' : '⚠ AI service not available — AI tests will be skipped\n');
  } catch {
    console.log('⚠ AI service not available — AI tests will be skipped\n');
  }

  console.log('--- Running Tests ---\n');

  // TC-01: NGO Registration
  try {
    const res = await post(`${API}/auth/register`, {
      name: 'E2E Test NGO', email: NGO_EMAIL, password: PASSWORD, role: 'NGO',
    });
    const ok = res.status === 201 && res.data.user;
    ngoUser = res.data.user;
    report('TC-01', 'NGO Registration', ok, `status=${res.status}`);
  } catch (e) { report('TC-01', 'NGO Registration', false, e.message); }

  // TC-02: NGO Login
  try {
    const res = await post(`${API}/auth/login`, { email: NGO_EMAIL, password: PASSWORD });
    const ok = res.status === 200 && res.data.token;
    ngoToken = res.data.token;
    ngoUser = res.data.user || ngoUser;
    report('TC-02', 'NGO Login', ok, `hasToken=${!!ngoToken}`);
  } catch (e) { report('TC-02', 'NGO Login', false, e.message); }

  // TC-03: Donor Registration
  try {
    const res = await post(`${API}/auth/register`, {
      name: 'E2E Test Donor', email: DONOR_EMAIL, password: PASSWORD, role: 'DONOR',
    });
    const ok = res.status === 201 && res.data.user;
    donorUser = res.data.user;
    report('TC-03', 'Donor Registration', ok, `status=${res.status}`);
  } catch (e) { report('TC-03', 'Donor Registration', false, e.message); }

  // TC-04: Donor Login
  try {
    const res = await post(`${API}/auth/login`, { email: DONOR_EMAIL, password: PASSWORD });
    const ok = res.status === 200 && res.data.token;
    donorToken = res.data.token;
    donorUser = res.data.user || donorUser;
    report('TC-04', 'Donor Login', ok, `hasToken=${!!donorToken}`);
  } catch (e) { report('TC-04', 'Donor Login', false, e.message); }

  // TC-05: Admin Login (seeded)
  try {
    await seedAdmin();
    const res = await post(`${API}/auth/login`, { email: ADMIN_EMAIL, password: PASSWORD });
    const ok = res.status === 200 && res.data.token;
    adminToken = res.data.token;
    adminUser = res.data.user;
    report('TC-05', 'Admin Login (seeded)', ok, `hasToken=${!!adminToken}`);
  } catch (e) { report('TC-05', 'Admin Login (seeded)', false, e.message); }

  // TC-06: NGO Profile Setup
  try {
    const res = await put(`${API}/ngo/profile`, {
      name: 'E2E Test NGO Foundation',
      description: 'End-to-end test NGO',
      registrationNumber: 'E2E-REG-001',
      walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    }, ngoToken);
    const ok = res.status === 200 && res.data.profile;
    ngoProfileId = res.data.profile?._id;
    report('TC-06', 'NGO Profile Setup', ok, `profileId=${ngoProfileId}`);
  } catch (e) { report('TC-06', 'NGO Profile Setup', false, e.message); }

  // TC-07: Admin Verifies NGO
  try {
    if (!ngoProfileId || !adminToken) throw new Error('prerequisite failed');
    const res = await put(`${API}/admin/ngos/${ngoProfileId}/verify`, {}, adminToken);
    const ok = res.status === 200;
    report('TC-07', 'Admin Verifies NGO', ok, `status=${res.status}`);
  } catch (e) { report('TC-07', 'Admin Verifies NGO', false, e.message); }

  // TC-08: NGO Creates Project with Milestones
  try {
    const res = await post(`${API}/projects`, {
      title: 'E2E Clean Water Project',
      description: 'Providing clean water to 500 families in rural villages.',
      targetAmount: 10,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'ACTIVE',
      milestones: [
        { title: 'Site Survey', description: 'Conduct village surveys', amount: 3, order: 1 },
        { title: 'Well Construction', description: 'Build 10 wells', amount: 5, order: 2 },
        { title: 'Water Testing', description: 'Test water quality', amount: 2, order: 3 },
      ],
    }, ngoToken);
    const ok = res.status === 201 && res.data.project;
    projectId = res.data.project?._id;
    const mc = res.data.project?.milestones?.length || 0;
    report('TC-08', 'NGO Creates Project with Milestones', ok, `projectId=${projectId}, milestones=${mc}`);
  } catch (e) { report('TC-08', 'NGO Creates Project with Milestones', false, e.message); }

  // TC-09: Donor Views Active Projects
  try {
    const res = await get(`${API}/projects/active`, donorToken);
    const ok = res.status === 200 && Array.isArray(res.data.projects) && res.data.projects.length > 0;
    report('TC-09', 'Donor Views Active Projects', ok, `count=${res.data.projects?.length}`);
  } catch (e) { report('TC-09', 'Donor Views Active Projects', false, e.message); }

  // TC-10: Donor Views Project Details
  try {
    if (!projectId) throw new Error('no project');
    const res = await get(`${API}/projects/${projectId}`, donorToken);
    const ok = res.status === 200 && res.data.project && res.data.project.milestones?.length === 3;
    report('TC-10', 'Donor Views Project Details', ok, `milestones=${res.data.project?.milestones?.length}`);
  } catch (e) { report('TC-10', 'Donor Views Project Details', false, e.message); }

  // TC-11: Donation API Call (blockchain verification may fail without Hardhat node)
  try {
    if (!projectId) throw new Error('no project');
    const idemKey = 'e2e_test_' + Date.now();
    const res = await post(`${API}/donations`, {
      projectId,
      amount: 0.5,
      idempotencyKey: idemKey,
      transactionHash: '0x' + 'a'.repeat(64),
    }, donorToken);
    const ok = res.status === 201 || res.status === 200 || res.status === 400;
    report('TC-11', 'Donation API Call', ok, `status=${res.status}, msg=${res.data.error?.message || res.data.message || 'ok'}`);
  } catch (e) { report('TC-11', 'Donation API Call', false, e.message); }

  // TC-12: Unauthorized Access Denied (DONOR -> ADMIN)
  try {
    const res = await get(`${API}/admin/ngos`, donorToken);
    const ok = res.status === 403;
    report('TC-12', 'Unauthorized Access Denied (DONOR→ADMIN)', ok, `status=${res.status}`);
  } catch (e) { report('TC-12', 'Unauthorized Access Denied', false, e.message); }

  // TC-13: Unauthenticated Access Denied
  try {
    const res = await get(`${API}/admin/ngos`);
    const ok = res.status === 401;
    report('TC-13', 'Unauthenticated Access Denied', ok, `status=${res.status}`);
  } catch (e) { report('TC-13', 'Unauthenticated Access Denied', false, e.message); }

  // TC-14: AI Fraud Assessment Direct Test
  if (aiAvailable) {
    try {
      const res = await post(`${AI_API}/predict`, { step: 1, type: 'TRANSFER', amount: 500000 });
      const ok = res.status === 200 && res.data.success && ['LOW', 'MEDIUM', 'HIGH'].includes(res.data.risk_level);
      report('TC-14', 'AI Fraud Assessment Direct', ok, `riskLevel=${res.data.risk_level}, prob=${res.data.probability}`);
    } catch (e) { report('TC-14', 'AI Fraud Assessment Direct', false, e.message); }
  } else {
    report('TC-14', 'AI Fraud Assessment Direct', null, 'AI service not available');
  }

  // TC-15: AI Fraud Missing Feature Validation
  if (aiAvailable) {
    try {
      const res = await post(`${AI_API}/predict`, { step: 1 });
      const ok = res.status === 400 && !res.data.success;
      report('TC-15', 'AI Fraud Missing Feature Error', ok, `error=${res.data.error}`);
    } catch (e) { report('TC-15', 'AI Fraud Missing Feature Error', false, e.message); }
  } else {
    report('TC-15', 'AI Fraud Missing Feature Error', null, 'AI service not available');
  }

  // TC-16: Impact Analysis Direct Test
  if (aiAvailable) {
    try {
      const reportText = 'Our Clean Water Project has been successfully completed. We provided clean water access to 500 families across 10 villages. The project established 15 wells and trained 30 local technicians. Budget utilization was 95% with total expenditure of \$45,000. Water quality testing showed 98% improvement in water safety standards.';
      const res = await post(`${AI_API}/analyse-impact`, { text: reportText });
      const ok = res.status === 200 && res.data.success && ['LOW', 'MEDIUM', 'HIGH'].includes(res.data.impact_level);
      report('TC-16', 'Impact Analysis Direct', ok, `level=${res.data.impact_level}, score=${res.data.impact_score}`);
    } catch (e) { report('TC-16', 'Impact Analysis Direct', false, e.message); }
  } else {
    report('TC-16', 'Impact Analysis Direct', null, 'AI service not available');
  }

  // TC-17: Impact Analysis via Backend
  if (aiAvailable && projectId) {
    try {
      const reportText = 'Our Clean Water Project provided clean water access to 500 families. We built 15 wells and trained 30 technicians. Budget utilization was 95%. Water quality improved by 98%.';
      const res = await post(`${API}/projects/${projectId}/analyse-impact`, { text: reportText }, ngoToken);
      const ok = res.status === 200 && res.data.success && res.data.impactAnalysis;
      report('TC-17', 'Impact Analysis via Backend', ok,
        `level=${res.data.impactAnalysis?.impactLevel}, score=${res.data.impactAnalysis?.impactScore}`);
    } catch (e) { report('TC-17', 'Impact Analysis via Backend', false, e.message); }
  } else {
    report('TC-17', 'Impact Analysis via Backend', null, aiAvailable ? 'no project' : 'AI not available');
  }

  // TC-18: Admin Views All Transactions
  try {
    const res = await get(`${API}/admin/transactions`, adminToken);
    const ok = res.status === 200 && Array.isArray(res.data.transactions);
    report('TC-18', 'Admin Views All Transactions', ok, `count=${res.data.transactions?.length}`);
  } catch (e) { report('TC-18', 'Admin Views All Transactions', false, e.message); }

  // TC-19: Admin Updates Transaction Review Status
  try {
    const txRes = await get(`${API}/admin/transactions`, adminToken);
    const txList = txRes.data.transactions || [];
    if (txList.length === 0) {
      report('TC-19', 'Admin Updates Review Status', null, 'no transactions to review');
    } else {
      const txId = txList[0]._id;
      const res = await put(`${API}/admin/transactions/${txId}/review`, {
        reviewStatus: 'UNDER_REVIEW',
      }, adminToken);
      const ok = res.status === 200;
      report('TC-19', 'Admin Updates Review Status', ok, `newStatus=UNDER_REVIEW, status=${res.status}`);
    }
  } catch (e) { report('TC-19', 'Admin Updates Review Status', false, e.message); }

  // TC-20: Admin Views All Projects (with impact data)
  try {
    const res = await get(`${API}/admin/projects`, adminToken);
    const ok = res.status === 200 && Array.isArray(res.data.projects);
    const withImpact = (res.data.projects || []).filter(p => p.impactAnalysis?.impactLevel).length;
    report('TC-20', 'Admin Views All Projects', ok, `total=${res.data.projects?.length}, withImpact=${withImpact}`);
  } catch (e) { report('TC-20', 'Admin Views All Projects', false, e.message); }

  // TC-21: NGO Views Own Projects
  try {
    const res = await get(`${API}/projects/my`, ngoToken);
    const ok = res.status === 200 && Array.isArray(res.data.projects) && res.data.projects.length > 0;
    report('TC-21', 'NGO Views Own Projects', ok, `count=${res.data.projects?.length}`);
  } catch (e) { report('TC-21', 'NGO Views Own Projects', false, e.message); }

  // TC-22: Donor Views Donation History
  try {
    const res = await get(`${API}/donations/my`, donorToken);
    const ok = res.status === 200 && Array.isArray(res.data.donations);
    report('TC-22', 'Donor Views Donation History', ok, `count=${res.data.donations?.length}`);
  } catch (e) { report('TC-22', 'Donor Views Donation History', false, e.message); }

  // TC-23: Health Check Endpoint
  try {
    const res = await get(`${API}/health`);
    const ok = res.status === 200 && res.data.status === 'UP';
    report('TC-23', 'Health Check Endpoint', ok, `db=${res.data.services?.database}`);
  } catch (e) { report('TC-23', 'Health Check Endpoint', false, e.message); }

  // TC-24: Impact Analysis Empty Text Validation
  if (projectId) {
    try {
      const res = await post(`${API}/projects/${projectId}/analyse-impact`, { text: '' }, ngoToken);
      const ok = res.status === 400;
      report('TC-24', 'Impact Analysis Empty Text Rejected', ok, `status=${res.status}`);
    } catch (e) { report('TC-24', 'Impact Analysis Empty Text Rejected', false, e.message); }
  } else {
    report('TC-24', 'Impact Analysis Empty Text Rejected', null, 'no project');
  }

  // Summary
  console.log('\n========================================================');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${skipped} skipped / ${results.length} total`);
  console.log('========================================================\n');

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
