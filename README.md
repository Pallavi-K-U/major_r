# Major R — Decentralized NGO Donation & Impact Transparency Platform

A full-stack, transparent charity and NGO donation platform integrating **Smart Contracts (Solidity)**, **MongoDB**, **Express/Node.js**, **React (Vite)**, **IPFS Storage**, and **AI Models** (Fraud Risk Detection & NLP-assisted Impact Analysis).

---

## Architecture Overview

```
React (Vite) Frontend [Port 5173]
       │
       ▼
Node.js / Express Backend [Port 5000]
       │
       ├──► MongoDB Database [Port 27017]
       │
       ├──► Hardhat / EVM Smart Contracts (NGOFundManager.sol) [Port 8545]
       │
       ├──► Local Mock IPFS Storage Gateway
       │
       └──► Python AI Microservice [Port 5001]
              ├── Fraud Risk Assessment Model (RandomForest / PaySim)
              └── Social Impact Analyser (spaCy NLP Engine)
```

---

## Key Features

1. **Role-Based Access Control (RBAC):**
   - **DONOR:** Browse active campaigns, donate via MetaMask on-chain, track transaction history and impact metrics.
   - **NGO:** Manage organization profiles, create milestone-based campaigns, upload supporting audit documents to IPFS, and submit project reports for AI impact assessment.
   - **ADMIN:** Verify NGO registrations, inspect global project and transaction ledgers, monitor AI fraud risk flags (`LOW`, `MEDIUM`, `HIGH`), and manage compliance review statuses (`UNDER_REVIEW`, `CLEARED`, `ESCALATED`).

2. **Blockchain & Smart Contract (`NGOFundManager.sol`):**
   - Milestone-based fund locking and release.
   - On-chain transaction receipt verification on the backend.
   - Checks-Effects-Interactions pattern for reentrancy defense.

3. **AI Microservices:**
   - **Fraud Detection:** Evaluates donation parameters and assigns bounded risk levels without modifying immutable blockchain records.
   - **Impact Analysis:** Natural Language Processing (NLP) pipeline extracting indicators, outcome metrics, budget utilization, and beneficiary counts from project reports.

4. **IPFS Storage:**
   - Content-addressed document storage generating SHA-256 Base58 `Qm` CIDs for audit reports and project proof.

---

## Tech Stack

- **Frontend:** React 18, Vite, Ethers.js v6
- **Backend:** Node.js, Express, Mongoose, JWT, Multer
- **Database:** MongoDB
- **Blockchain:** Solidity 0.8.24, Hardhat, Ethers.js
- **AI & NLP:** Python 3, Flask, scikit-learn, spaCy, pandas, joblib

---

## Getting Started

### Prerequisites
- Node.js (v18+) & npm
- Python (3.10+) with `pip`
- MongoDB (running locally on port 27017)
- MetaMask browser extension

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Pallavi-K-U/major_r.git
   cd major_r
   ```

2. **Install Node.js dependencies:**
   ```bash
   # Backend dependencies
   cd backend && npm install && cd ..

   # Frontend dependencies
   cd frontend && npm install && cd ..

   # Blockchain dependencies
   cd blockchain && npm install && cd ..
   ```

3. **Install Python dependencies:**
   ```bash
   pip install flask pandas scikit-learn joblib spacy
   python -m spacy download en_core_web_sm
   ```

4. **Configure Environment Variables:**
   ```bash
   cp backend/.env.example backend/.env
   ```

---

## Running the Application

Start the services in separate terminals:

1. **Local Blockchain Node & Contract Deployment:**
   ```bash
   cd blockchain
   npx hardhat node
   # In another terminal:
   npx hardhat run scripts/deploy.js --network localhost
   ```

2. **Python AI Service:**
   ```bash
   cd ai
   python ai_server.py
   ```

3. **Backend API:**
   ```bash
   cd backend
   node server.js
   ```

4. **Frontend Application:**
   ```bash
   cd frontend
   npm run dev
   ```

Open **`http://localhost:5173`** in your browser.

---

## Testing & Quality Assurance

- **End-to-End System Tests:** `node backend/verify_final_qa_security.mjs`
- **Smart Contract Unit Tests:** `cd blockchain && npx hardhat test`
- **AI Impact Engine Tests:** `python ai/verify_phase_9.py`

Detailed reports are available in the [`TESTING/`](TESTING/) directory and [`SECURITY_AUDIT.md`](SECURITY_AUDIT.md).

---

## License

This project is open-source under the MIT License.
