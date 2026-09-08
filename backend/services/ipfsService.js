import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GATEWAY_DIR = path.resolve(__dirname, '../scratch/ipfs_mock_gateway');

// Ensure storage gateway directory exists
if (!fs.existsSync(GATEWAY_DIR)) {
  fs.mkdirSync(GATEWAY_DIR, { recursive: true });
}

// Generate base58 mock Qm CID based on SHA-256 hash of the content
const generateMockCid = (buffer) => {
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const base58Alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let num = BigInt('0x' + hash);
  let cid = '';
  while (num > 0n) {
    const remainder = Number(num % 58n);
    cid = base58Alphabet[remainder] + cid;
    num = num / 58n;
  }
  // Construct a standard 46 character Qm CID
  return 'Qm' + cid.substring(0, 44);
};

export const uploadToIpfs = async (fileBuffer) => {
  // TC-9: IPFS service unavailable simulation
  if (process.env.IPFS_UNAVAILABLE === 'true') {
    throw new Error('IPFS daemon connection failed / service unavailable');
  }

  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error('Cannot upload empty buffer to IPFS');
  }

  const cid = generateMockCid(fileBuffer);
  const targetPath = path.join(GATEWAY_DIR, cid);
  
  fs.writeFileSync(targetPath, fileBuffer);
  return cid;
};

export const catFromIpfs = async (cid) => {
  if (process.env.IPFS_UNAVAILABLE === 'true') {
    throw new Error('IPFS daemon connection failed / service unavailable');
  }

  const targetPath = path.join(GATEWAY_DIR, cid);
  if (!fs.existsSync(targetPath)) {
    throw new Error('CID not found on local mock IPFS gateway');
  }

  return fs.readFileSync(targetPath);
};

export const deleteFromIpfs = async (cid) => {
  const targetPath = path.join(GATEWAY_DIR, cid);
  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
  }
};
