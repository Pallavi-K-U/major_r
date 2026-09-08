import { spawn } from 'child_process';
import mongoose from 'mongoose';
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
  console.log('=== Starting Phase 6 E2E IPFS Document Storage Verification ===');

  let backendProc = null;
  const report = [];

  // Helper to start the Express server
  const startBackend = (envOverrides = {}) => {
    return spawn('node', ['server.js'], {
      cwd: BACKEND_DIR,
      env: {
        ...process.env,
        PORT: '5000',
        MONGODB_URI: 'mongodb://localhost:27017/major_r',
        JWT_SECRET: 'test_jwt_secret_key_12345678',
        FRONTEND_URL: 'http://localhost:5173',
        ...envOverrides
      }
    });
  };

  try {
    // 1. Clear database
    await mongoose.connect('mongodb://localhost:27017/major_r');
    await mongoose.connection.db.dropDatabase();
    console.log('Database cleared.');

    // Import models dynamically to avoid ESM initialization races
    const userModelPath = path.resolve(BACKEND_DIR, 'models/user.js');
    const { default: User } = await import(pathToFileURL(userModelPath).href);

    const projectModelPath = path.resolve(BACKEND_DIR, 'models/project.js');
    const { default: Project } = await import(pathToFileURL(projectModelPath).href);

    const documentModelPath = path.resolve(BACKEND_DIR, 'models/document.js');
    const { default: Document } = await import(pathToFileURL(documentModelPath).href);

    // Seed Users
    const salt = await bcryptjs.genSalt(10);
    const passHash = await bcryptjs.hash('password123', salt);

    const donor1 = new User({ name: 'Donor One', email: 'donor1@test.com', passwordHash: passHash, role: 'DONOR' });
    const ngo1 = new User({ name: 'NGO One', email: 'ngo1@test.com', passwordHash: passHash, role: 'NGO' });
    const ngo2 = new User({ name: 'NGO Two', email: 'ngo2@test.com', passwordHash: passHash, role: 'NGO' });
    const admin = new User({ name: 'Admin User', email: 'admin@test.com', passwordHash: passHash, role: 'ADMIN' });

    await donor1.save();
    await ngo1.save();
    await ngo2.save();
    await admin.save();
    console.log('Users seeded.');

    // Seed Projects
    const project1 = new Project({
      title: 'Water Wells NGO 1',
      description: 'NGO 1 active project.',
      ngoId: ngo1._id,
      targetAmount: 10,
      startDate: '2026-09-01',
      endDate: '2026-12-31',
      status: 'ACTIVE',
      milestones: [{ title: 'M1', amount: 10, order: 1 }]
    });

    const project2 = new Project({
      title: 'Forest Planting NGO 2',
      description: 'NGO 2 active project.',
      ngoId: ngo2._id,
      targetAmount: 5,
      startDate: '2026-09-01',
      endDate: '2026-12-31',
      status: 'ACTIVE',
      milestones: [{ title: 'M1', amount: 5, order: 1 }]
    });

    await project1.save();
    await project2.save();
    console.log('Campaign projects registered in MongoDB.');

    // 2. Start Backend
    console.log('Starting Express backend...');
    backendProc = startBackend();
    await sleep(4000);

    // Fetch JWT tokens
    const login = async (email) => {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'password123' })
      });
      const data = await res.json();
      return data.token;
    };

    const donorToken = await login('donor1@test.com');
    const ngo1Token = await login('ngo1@test.com');
    const ngo2Token = await login('ngo2@test.com');

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

    let uploadedCid = '';
    let uploadedDocId = '';

    // TC-1: Upload valid PDF
    await runTestCase('TC-1', 'Upload valid PDF to own project', async () => {
      const formData = new FormData();
      formData.append('projectId', project1._id.toString());
      const pdfBlob = new Blob(['%PDF-1.4 mock content'], { type: 'application/pdf' });
      formData.append('file', pdfBlob, 'financial_report.pdf');

      const res = await fetch('http://localhost:5000/api/documents', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${ngo1Token}` },
        body: formData
      });
      const data = await res.json();

      if (data.success && data.document) {
        uploadedCid = data.document.ipfsCid;
        uploadedDocId = data.document._id;
      }

      return assertEqual(res.status, 201, 'Returns HTTP 201 Created') &&
             assertEqual(data.success, true, 'success is true') &&
             assertEqual(typeof uploadedCid, 'string', 'IPFS CID is returned as string') &&
             assertEqual(uploadedCid.startsWith('Qm'), true, 'CID has correct multihash format');
    });

    // TC-2: Upload unsupported file type
    await runTestCase('TC-2', 'Upload unsupported file type (txt)', async () => {
      const formData = new FormData();
      formData.append('projectId', project1._id.toString());
      const textBlob = new Blob(['plain text report'], { type: 'text/plain' });
      formData.append('file', textBlob, 'notes.txt');

      const res = await fetch('http://localhost:5000/api/documents', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${ngo1Token}` },
        body: formData
      });
      const data = await res.json();

      return assertEqual(res.status, 400, 'Returns HTTP 400 Bad Request') &&
             assertEqual(data.success, false, 'success is false') &&
             assertEqual(data.error?.message.includes('Unsupported'), true, 'Error message is clear');
    });

    // TC-3: Upload without file
    await runTestCase('TC-3', 'Upload without attaching a file', async () => {
      const formData = new FormData();
      formData.append('projectId', project1._id.toString());

      const res = await fetch('http://localhost:5000/api/documents', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${ngo1Token}` },
        body: formData
      });
      const data = await res.json();

      return assertEqual(res.status, 400, 'Returns HTTP 400 Bad Request') &&
             assertEqual(data.success, false, 'success is false') &&
             assertEqual(data.error?.message.includes('No file'), true, 'Reports missing file error');
    });

    // TC-4: Unauthorized donor attempts upload
    await runTestCase('TC-4', 'Donor role attempts upload', async () => {
      const formData = new FormData();
      formData.append('projectId', project1._id.toString());
      const pdfBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      formData.append('file', pdfBlob, 'exploit.pdf');

      const res = await fetch('http://localhost:5000/api/documents', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${donorToken}` },
        body: formData
      });
      const data = await res.json();

      return assertEqual(res.status, 403, 'Returns HTTP 403 Forbidden') &&
             assertEqual(data.success, false, 'success is false');
    });

    // TC-5: NGO uploads document to another NGO's project
    await runTestCase('TC-5', "NGO uploads to another NGO's project", async () => {
      const formData = new FormData();
      formData.append('projectId', project2._id.toString()); // Project 2 belongs to NGO 2
      const pdfBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      formData.append('file', pdfBlob, 'ngo1_report.pdf');

      const res = await fetch('http://localhost:5000/api/documents', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${ngo1Token}` }, // NGO 1 token
        body: formData
      });
      const data = await res.json();

      return assertEqual(res.status, 403, 'Returns HTTP 403 Forbidden') &&
             assertEqual(data.success, false, 'success is false') &&
             assertEqual(data.error?.message.includes('own projects'), true, 'Authorization checks ownership');
    });

    // TC-6: CID stored correctly in MongoDB
    await runTestCase('TC-6', 'CID is stored correctly in MongoDB', async () => {
      const doc = await Document.findById(uploadedDocId);

      return assertEqual(doc !== null, true, 'Document record found in DB') &&
             assertEqual(doc.ipfsCid, uploadedCid, 'CID stored in DB matches on-chain CID');
    });

    // TC-7: Retrieve document using stored CID
    await runTestCase('TC-7', 'Retrieve document using stored CID', async () => {
      const res = await fetch(`http://localhost:5000/api/documents/${uploadedCid}/download`);
      const bodyText = await res.text();

      return assertEqual(res.status, 200, 'Returns HTTP 200 OK') &&
             assertEqual(res.headers.get('content-type'), 'application/pdf', 'Content-Type matches PDF') &&
             assertEqual(bodyText, '%PDF-1.4 mock content', 'Downloaded contents match uploaded content');
    });

    // TC-9: IPFS service unavailable
    await runTestCase('TC-9', 'IPFS service unavailable simulation', async () => {
      console.log('  Restarting backend with offline IPFS flag...');
      backendProc.kill('SIGKILL');
      await sleep(1500);

      // Start backend in offline mode
      backendProc = startBackend({ IPFS_UNAVAILABLE: 'true' });
      await sleep(4000);

      const formData = new FormData();
      formData.append('projectId', project1._id.toString());
      const pdfBlob = new Blob(['%PDF-1.4 test'], { type: 'application/pdf' });
      formData.append('file', pdfBlob, 'offline_report.pdf');

      const res = await fetch('http://localhost:5000/api/documents', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${ngo1Token}` },
        body: formData
      });

      // Verify no document with this title exists in database
      const docInDb = await Document.findOne({ fileName: 'offline_report.pdf' });

      // Restart backend normally for final tests
      console.log('  Restoring backend to normal mode...');
      backendProc.kill('SIGKILL');
      await sleep(1500);
      backendProc = startBackend();
      await sleep(4000);

      const isErrorStatus = res.status === 400 || res.status === 500 || res.status === 503;
      return assertEqual(isErrorStatus, true, `Upload request returns HTTP error status (${res.status})`) &&
             assertEqual(docInDb === null, true, 'No metadata record created in MongoDB on failure');
    });

    // TC-10: Verify no large document content is stored directly in MongoDB
    await runTestCase('TC-10', 'Verify no large document content is stored in MongoDB', async () => {
      const doc = await Document.findById(uploadedDocId).lean();
      
      const properties = Object.keys(doc);
      console.log('  Persisted properties:', properties);

      const containsLargeContent = properties.includes('buffer') || properties.includes('content') || properties.includes('file');
      
      return assertEqual(containsLargeContent, false, 'Database does not contain binary content fields') &&
             assertEqual(doc.ipfsCid !== undefined, true, 'Database stores reference CID') &&
             assertEqual(doc.fileName !== undefined, true, 'Database stores metadata fileName');
    });

    // TC-8: Delete/remove document metadata authorization checks
    await runTestCase('TC-8', 'Delete document uploader authorization checks', async () => {
      // 1. NGO 2 (non-uploader) attempts deletion
      const resUnauth = await fetch(`http://localhost:5000/api/documents/${uploadedDocId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${ngo2Token}` }
      });

      // 2. NGO 1 (uploader) attempts deletion
      const resAuth = await fetch(`http://localhost:5000/api/documents/${uploadedDocId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${ngo1Token}` }
      });

      const docInDb = await Document.findById(uploadedDocId);

      return assertEqual(resUnauth.status, 403, 'Unauthorized delete returns HTTP 403 Forbidden') &&
             assertEqual(resAuth.status, 200, 'Authorized delete returns HTTP 200 OK') &&
             assertEqual(docInDb === null, true, 'Document deleted from database');
    });

    console.log('\n=== Phase 6 Verification Summary ===');
    let allPass = true;
    for (const item of report) {
      console.log(`${item.id}: ${item.status}`);
      if (item.status === 'FAIL') allPass = false;
    }

    if (allPass) {
      console.log('ALL PHASE 6 TESTS PASSED SUCCESSFULLY.');
      process.exit(0);
    } else {
      console.log('SOME PHASE 6 TESTS FAILED.');
      process.exit(1);
    }

  } catch (err) {
    console.error('Fatal error in testing framework:', err);
    process.exit(1);
  } finally {
    console.log('Cleaning up processes...');
    if (backendProc) backendProc.kill('SIGKILL');
    await sleep(1000);
    await mongoose.disconnect();
  }
}

runTests();
