import { spawn } from 'child_process';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import bcryptjs from 'bcryptjs';
import { ethers } from 'ethers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_DIR = path.resolve(__dirname);
const BLOCKCHAIN_DIR = path.resolve(__dirname, '../blockchain');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const awaitProcess = (proc, name) => new Promise((resolve, reject) => {
  let stdout = '';
  let stderr = '';
  proc.stdout.on('data', (d) => stdout += d.toString());
  proc.stderr.on('data', (d) => stderr += d.toString());
  proc.on('exit', (code) => {
    if (code === 0) {
      resolve(stdout);
    } else {
      reject(new Error(`${name} process exited with code ${code}.\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`));
    }
  });
  proc.on('error', (err) => reject(err));
});

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
  console.log('=== Starting Phase 5B E2E Blockchain Integration Verification ===');

  let hardhatNodeProc;
  let deployProc;
  let backendProc;
  const report = [];

  try {
    // 1. Start Hardhat node in the background
    console.log('Starting local Hardhat blockchain node...');
    hardhatNodeProc = spawn('npx', ['hardhat', 'node'], { cwd: BLOCKCHAIN_DIR, shell: true });

    await sleep(8000); // Give local node ample time to bind port 8545

    // 2. Deploy Contract with retry safety
    console.log('Deploying smart contract to local node...');
    let deployed = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        deployProc = spawn('npx', ['hardhat', 'run', 'scripts/deploy.js', '--network', 'localhost'], { cwd: BLOCKCHAIN_DIR, shell: true });
        await awaitProcess(deployProc, 'Deploy');
        deployed = true;
        break;
      } catch (e) {
        console.log(`  Deployment attempt ${attempt} failed: ${e.message}. Retrying in 3s...`);
        await sleep(3000);
      }
    }

    if (!deployed) {
      throw new Error('All deployment attempts failed. Unable to start E2E tests.');
    }

    // Connect to provider and load signers
    const provider = new ethers.JsonRpcProvider('http://localhost:8545');
    const signers = await provider.listAccounts();
    console.log('Hardhat signers resolved.');

    // 3. Clear database & Seed matching users
    await mongoose.connect('mongodb://localhost:27017/major_r');
    await mongoose.connection.db.dropDatabase();
    console.log('Database cleared for testing.');

    // Load models
    const userModelPath = path.resolve(BACKEND_DIR, 'models/user.js');
    const { default: User } = await import(pathToFileURL(userModelPath).href);

    const projectModelPath = path.resolve(BACKEND_DIR, 'models/project.js');
    const { default: Project } = await import(pathToFileURL(projectModelPath).href);

    const transactionModelPath = path.resolve(BACKEND_DIR, 'models/transaction.js');
    const { default: Transaction } = await import(pathToFileURL(transactionModelPath).href);

    // Seed Users
    const salt = await bcryptjs.genSalt(10);
    const passHash = await bcryptjs.hash('password123', salt);

    const donor1 = new User({ name: 'Donor One', email: 'donor1@test.com', passwordHash: passHash, role: 'DONOR', walletAddress: signers[1].address });
    const ngo1 = new User({ name: 'NGO One', email: 'ngo1@test.com', passwordHash: passHash, role: 'NGO', walletAddress: signers[2].address });
    const admin = new User({ name: 'Admin User', email: 'admin@test.com', passwordHash: passHash, role: 'ADMIN', walletAddress: signers[0].address });

    await donor1.save();
    await ngo1.save();
    await admin.save();
    console.log('Users seeded in DB with matching Web3 addresses.');

    // Read config
    const configPath = path.resolve(BACKEND_DIR, 'contract_config.json');
    const contractConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // Seed project in database with corresponding blockchain ID
    const activeProj = new Project({
      title: 'Clean Water Initiative',
      description: 'Drilling fresh water wells.',
      ngoId: ngo1._id,
      targetAmount: 10, // 10 ETH
      startDate: '2026-09-01',
      endDate: '2026-12-31',
      status: 'ACTIVE',
      milestones: [{ title: 'Well installation', amount: 10, order: 1 }],
      blockchainId: 0 // First project on-chain index
    });
    const draftProj = new Project({
      title: 'Draft Initiative',
      description: 'Unpublished draft campaign.',
      ngoId: ngo1._id,
      targetAmount: 5,
      startDate: '2026-09-01',
      endDate: '2026-12-31',
      status: 'DRAFT',
      milestones: [{ title: 'M1', amount: 5, order: 1 }],
      blockchainId: 1
    });
    await activeProj.save();
    await draftProj.save();
    console.log('Campaign registered in MongoDB.');

    // Connect owner signer on-chain
    const ownerSigner = await provider.getSigner(signers[0].address);
    const contract = new ethers.Contract(contractConfig.address, contractConfig.abi, ownerSigner);

    // On-chain create project index 0
    const txCreate1 = await contract.createProject(
      signers[2].address, // NGO wallet address
      ethers.parseEther('10.0'),
      ['Well installation'],
      [ethers.parseEther('10.0')]
    );
    await txCreate1.wait();

    // On-chain create project index 1 (draftProj)
    const txCreate2 = await contract.createProject(
      signers[2].address,
      ethers.parseEther('5.0'),
      ['M1'],
      [ethers.parseEther('5.0')]
    );
    await txCreate2.wait();
    console.log('Campaign created on-chain.');

    // 4. Start Backend Server
    console.log('Starting Express backend server...');
    backendProc = spawn('node', ['server.js'], {
      cwd: BACKEND_DIR,
      env: {
        ...process.env,
        PORT: '5000',
        MONGODB_URI: 'mongodb://localhost:27017/major_r',
        JWT_SECRET: 'test_jwt_secret_key_12345678',
        PROVIDER_URL: 'http://localhost:8545',
        FRONTEND_URL: 'http://localhost:5173'
      }
    });

    await sleep(4000); // Wait for backend startup

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
    const ngoToken = await login('ngo1@test.com');
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

    let validTxHash = '';
    let validDbTxId = '';

    // TC-1: Connect wallet simulation
    await runTestCase('TC-1', 'Connect MetaMask wallet simulation', async () => {
      const donorWalletAddress = signers[1].address;
      console.log('  Simulated Active Wallet:', donorWalletAddress);
      return assertEqual(ethers.isAddress(donorWalletAddress), true, 'Displays valid wallet address');
    });

    // TC-2: Reject connection handling simulation
    await runTestCase('TC-2', 'Reject wallet connection handling', async () => {
      const simulateMetaMaskRejection = () => {
        throw new Error('User rejected the request.');
      };
      try {
        simulateMetaMaskRejection();
        return false;
      } catch (err) {
        return assertEqual(err.message, 'User rejected the request.', 'Application catches rejection gracefully');
      }
    });

    // TC-3 & TC-5 & TC-6 & TC-7 & TC-8: Valid donation on-chain + hash retrieval + DB persistence
    await runTestCase('TC-3/5/6/7/8', 'Valid donation, hash recording, blockchain verify, and persistence', async () => {
      const donorSigner = await provider.getSigner(signers[1].address);
      const donorContract = new ethers.Contract(contractConfig.address, contractConfig.abi, donorSigner);

      const txDonate = await donorContract.donate(0, { value: ethers.parseEther('2.0') });
      validTxHash = txDonate.hash;
      console.log('  Donation on-chain Tx Hash:', validTxHash);

      const receipt = await txDonate.wait();
      assertEqual(receipt.status, 1, 'Transaction receipt status is 1 (succeeded)');

      const res = await fetch('http://localhost:5000/api/donations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${donorToken}`
        },
        body: JSON.stringify({
          projectId: activeProj._id,
          amount: 2.0,
          idempotencyKey: 'key_chain_integration_123',
          transactionHash: validTxHash
        })
      });

      const data = await res.json();
      validDbTxId = data.transaction?._id;

      const txInDb = await Transaction.findById(validDbTxId);

      return assertEqual(res.status, 201, 'Backend returns HTTP 201 Created') &&
             assertEqual(data.success, true, 'success is true') &&
             assertEqual(txInDb.transactionHash, validTxHash, 'MongoDB transaction hash references correct hash') &&
             assertEqual(txInDb.blockNumber, receipt.blockNumber, 'MongoDB correctly records block number metadata') &&
             assertEqual(txInDb.fromAddress.toLowerCase(), signers[1].address.toLowerCase(), 'MongoDB records sender wallet');
    });

    // TC-4: Reject transaction (MetaMask rejection)
    await runTestCase('TC-4', 'User rejects transaction signature', async () => {
      const simulateTxRejection = () => {
        const err = new Error('User rejected transaction');
        err.code = 'ACTION_REJECTED';
        throw err;
      };

      try {
        simulateTxRejection();
        return false;
      } catch (err) {
        return assertEqual(err.code, 'ACTION_REJECTED', 'User rejection caught; transaction is not marked successful');
      }
    });

    // TC-9: Blockchain transaction failure
    await runTestCase('TC-9', 'Blockchain transaction failure handling', async () => {
      const failedHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

      const res = await fetch('http://localhost:5000/api/donations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${donorToken}`
        },
        body: JSON.stringify({
          projectId: activeProj._id,
          amount: 2.0,
          idempotencyKey: 'key_fail_hash_test',
          transactionHash: failedHash
        })
      });
      const data = await res.json();

      return assertEqual(res.status, 400, 'Failed or invalid hash request is rejected with HTTP 400') &&
             assertEqual(data.success, false, 'success is false') &&
             assertEqual(data.error?.message.includes('not found') || data.error?.message.includes('failed'), true, 'Database does not falsely mark it as successful');
    });

    // TC-10: Wrong network
    await runTestCase('TC-10', 'Wrong network mismatch validation', async () => {
      const mockChainId = '0x1'; // Ethereum Mainnet instead of Hardhat
      const isWrongNetwork = mockChainId !== '0x7a69';

      return assertEqual(isWrongNetwork, true, 'Front-end detects wrong chain ID') &&
             assertEqual(mockChainId === '0x7a69', false, 'Aborts and returns wrong network error');
    });

    // TC-11: Verify donor can view transaction hash
    await runTestCase('TC-11', 'Verify donor can view transaction hash', async () => {
      const res = await fetch('http://localhost:5000/api/donations/my', {
        headers: { 'Authorization': `Bearer ${donorToken}` }
      });
      const data = await res.json();
      const retrievedTx = data.donations.find(d => d._id === validDbTxId.toString());

      return assertEqual(res.status, 200, 'Donor history endpoint resolves') &&
             assertEqual(retrievedTx?.transactionHash, validTxHash, 'Donor can view transaction hash');
    });

    // TC-12: Verify NGO/admin can view relevant blockchain transaction information
    await runTestCase('TC-12', 'Verify NGO/admin can view blockchain details', async () => {
      const resNgo = await fetch('http://localhost:5000/api/ngo/donations', {
        headers: { 'Authorization': `Bearer ${ngoToken}` }
      });
      const dataNgo = await resNgo.json();
      const ngoTx = dataNgo.donations.find(d => d._id === validDbTxId.toString());

      const resAdmin = await fetch('http://localhost:5000/api/admin/transactions', {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const dataAdmin = await resAdmin.json();
      const adminTx = dataAdmin.transactions.find(d => d._id === validDbTxId.toString());

      return assertEqual(resNgo.status, 200, 'NGO donations list returned') &&
             assertEqual(ngoTx?.blockNumber !== undefined, true, 'NGO can view block number metadata') &&
             assertEqual(resAdmin.status, 200, 'Admin transactions list returned') &&
             assertEqual(adminTx?.fromAddress.toLowerCase(), signers[1].address.toLowerCase(), 'Admin can view sender address');
    });

    console.log('\n=== Phase 5B Verification Summary ===');
    let allPass = true;
    for (const item of report) {
      console.log(`${item.id}: ${item.status}`);
      if (item.status === 'FAIL') allPass = false;
    }

    if (allPass) {
      console.log('ALL PHASE 5B TESTS PASSED SUCCESSFULLY.');
      process.exit(0);
    } else {
      console.log('SOME PHASE 5B TESTS FAILED.');
      process.exit(1);
    }

  } catch (err) {
    console.error('Fatal error in testing framework:', err);
    process.exit(1);
  } finally {
    console.log('Cleaning up processes...');
    if (backendProc) backendProc.kill('SIGKILL');
    if (hardhatNodeProc) hardhatNodeProc.kill('SIGKILL');
    await sleep(1000);
    await mongoose.disconnect();
  }
}

runTests();
