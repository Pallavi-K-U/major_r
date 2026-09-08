# Security Audit & Architecture Risk Assessment

**Project:** Major R — Decentralized NGO Donation & Impact Transparency Platform  
**Audit Date:** 2026-08-30  
**Audit Scope:** Full Stack (Node.js/Express API, MongoDB, Hardhat/Solidity Smart Contracts, Python AI Service, React Frontend, IPFS Gateway)  
**Status:** **DEVELOPMENT STAGE — NOT PRODUCTION CERTIFIED**

---

> [!CAUTION]
> **DISCLAIMER: DEVELOPMENT & ACADEMIC PROTOTYPE — NOT PRODUCTION CERTIFIED**  
> This security assessment reflects the current development and academic research baseline of the Major R platform. While robust defensive controls, strict role-based access validation, and defensive programming patterns have been implemented and verified, **this software is a functional academic/development prototype and is NOT certified for production deployment, commercial use, or mainnet financial transactions**. Significant infrastructure hardening, third-party penetration testing, and formal smart contract auditing are mandatory prerequisites before handling real-world monetary assets.

---

## 1. Executive Summary

A full-spectrum defensive security audit was conducted to identify vulnerabilities, evaluate access controls, check data exposure vectors, and analyze failure modes across all architectural layers.

### Key Audit Findings
- **Authentication & RBAC:** Strict server-side verification using JSON Web Tokens (JWT) and role validation. Public self-assignment of the `ADMIN` role is completely blocked.
- **Data Protection:** Password hashes are computed using `bcryptjs` with a salt factor of 10 and are excluded from serialized JSON responses via Mongoose transforms.
- **Smart Contract Defenses:** `NGOFundManager.sol` implements `onlyOwner` access control, state machine validation, and the Checks-Effects-Interactions pattern for milestone payouts.
- **Error Handling & Leakage:** Production mode masks stack traces and internal database schemas.
- **AI Service Isolation:** AI models operate non-blockingly; synthetic fraud predictions and NLP extraction results are explicitly presented as AI-assisted evaluations rather than authoritative proof.

---

## 2. Component-by-Component Security Evaluation

### 2.1 Authentication & Session Management
- **Password Hashing:** `bcryptjs` is utilized with a work factor of 10. Passwords must be a minimum of 8 characters.
- **Token Format & Verification:** JWT tokens are issued with a 24-hour expiration (`expiresIn: '24h'`). Each incoming request to a protected endpoint triggers database user verification to ensure the user still exists and their account status is current.
- **Identified Weaknesses:**
  - *Fallback Secret:* If the `JWT_SECRET` environment variable is not supplied in `.env`, the code falls back to `fallback_secret_key`. In production, startup should abort immediately if `JWT_SECRET` is absent.
  - *No Token Revocation Mechanism:* If a user is compromised or logs out, the JWT remains cryptographically valid until expiration unless a server-side token blacklist (e.g., in Redis) is checked.

---

### 2.2 Authorization & Role-Based Access Control (RBAC)
- **Role Enforcement:** Three roles are recognized: `DONOR`, `NGO`, and `ADMIN`. Routes are guarded by the `authorizeRoles(...roles)` middleware.
- **Privilege Escalation Defense:** The registration controller strictly forbids role values of `ADMIN`.
- **Resource Ownership Verification:**
  - Projects can only be edited or analysed by the owning NGO (`project.ngoId === req.user._id`).
  - Documents can only be deleted by the uploader (`doc.uploadedBy === req.user._id`).
  - User profile updates verify `req.user.id === req.params.id || req.user.role === 'ADMIN'`.
  - Profile updates whitelist only `name` and `walletAddress`, preventing tampering with `role` or `email`.

---

### 2.3 Input Validation & Injection Defenses
- **NoSQL Injection:** Mongoose strict schema casting prevents typical raw query object injection attacks. Request parameters are cast and validated explicitly.
- **MIME Type Validation:** The document controller enforces a whitelist: `application/pdf`, `image/png`, `image/jpeg`, `image/jpg`. Executable and script extensions are rejected with HTTP 400.
- **Multer Memory Storage:** Uploaded files are stored in memory buffers rather than temporary filesystem directories, preventing arbitrary file upload traversal vulnerabilities.
- **Date & Arithmetic Bounds:** Project creation enforces that `targetAmount > 0`, `endDate > startDate`, and the sum of all milestone allocations exactly equals `targetAmount`.

---

### 2.4 Smart Contract Security (`NGOFundManager.sol`)
- **Language & Compiler:** Solidity `^0.8.24` (includes built-in overflow/underflow checking).
- **Access Control:** `onlyOwner` modifier restricts `releaseMilestone` and `setProjectStatus`.
- **Checks-Effects-Interactions:** In `releaseMilestone`:
  ```solidity
  milestone.released = true;
  project.releasedAmount += amountToRelease;
  payable(project.ngo).transfer(amountToRelease);
  ```
  State variables are updated *before* the external transfer is initiated, neutralizing basic reentrancy vulnerabilities.
- **Identified Contract Limitations:**
  - *Use of `transfer()` vs `call()`:* `transfer()` forwards a fixed 2300 gas stipend. If the NGO address is a smart contract wallet (such as a Gnosis Safe or account abstraction contract) that consumes more than 2300 gas in its `receive()` function, the transfer will revert. Modern best practice recommends `call{value: amountToRelease}("")` coupled with OpenZeppelin's `ReentrancyGuard`.
  - *No Upgradeability / Pausability:* The contract has no emergency pause mechanism (`Pausable`) in case of unexpected state anomalies.

---

### 2.5 IPFS Document Storage Integrity
- **Mock Gateway:** The current environment uses a mock IPFS gateway (`ipfsService.js`) storing data on the local filesystem and calculating SHA-256 Base58 `Qm` hashes.
- **Limitation:** In a real-world deployment, files must be distributed across public IPFS nodes or pinning services (e.g., Pinata, Web3.Storage) with virus scanning and rate-limited gateway retrieval.

---

### 2.6 AI Models & Fraud Risk Assessment
- **Synthetic Training Data Disclaimer:** The fraud detection model was trained on the synthetic PaySim mobile money dataset. Its predictions cannot be claimed as definitive proof of real-world financial fraud and are explicitly presented as `LOW`, `MEDIUM`, or `HIGH` risk assessments.
- **Non-Blocking Architecture:** The backend treats AI predictions as non-blocking auxiliary data. If the AI server is offline or returns an error, the core donation transaction is still safely recorded in MongoDB and the blockchain ledger without crashing.
- **Input Sanitization:** The Python Flask service (`ai_server.py`) validates all input fields, feature types, and non-negative constraints.

---

### 2.7 Dependency Vulnerability Audit
- **Backend Runtime:** `npm audit` reported **0 vulnerabilities** across all production backend dependencies.
- **Toolchain / Dev Dependencies:**
  - Smart contract build tools (`hardhat`, `solidity-coverage`, `@ethersproject`) contain development-only vulnerabilities in old test runners. These do not run in production or impact the compiled bytecode.
  - Frontend bundler (`vite` / `esbuild`) development server advisories apply to local dev server hosting.

---

## 3. Honest Disclosure of Limitations & Residual Risks

| Risk Area | Current State | Risk Severity | Production Requirement |
| :--- | :--- | :---: | :--- |
| **Secrets Management** | `.env` file on disk with code fallback defaults | **MEDIUM** | Use AWS Secrets Manager, HashiCorp Vault, or GCP Secret Manager. Abort startup on missing secrets. |
| **Smart Contract Payouts** | Fixed `transfer()` stipend (2300 gas) | **MEDIUM** | Replace with `call{value: ...}("")` protected by OpenZeppelin `ReentrancyGuard`. |
| **Token Invalidation** | Stateless JWT without revocation list | **LOW** | Add Redis-backed token blacklist or short-lived access tokens with refresh token rotation. |
| **IPFS Storage** | Local filesystem mock gateway | **MEDIUM** | Integrate live IPFS cluster with cryptographic verification and CID pinning. |
| **Rate Limiting / Anti-Spam** | No global HTTP rate limiting middleware | **MEDIUM** | Implement `express-rate-limit` and CAPTCHA / Proof of Work on public endpoints. |
| **CORS Configuration** | Restricted to single origin in `FRONTEND_URL` | **LOW** | Ensure production reverse proxy (Nginx/Cloudflare) enforces strict HSTS and CORS. |
| **Database Transactions** | Automatic fallback for standalone MongoDB | **LOW** | Mandate MongoDB Replica Set in production to guarantee multi-document ACID transactions. |

---

## 4. Production Hardening Recommendations

1. **Deploy Smart Contract to Audited Network:**
   - Execute formal verification and third-party audit before mainnet deployment.
   - Implement OpenZeppelin `Ownable2Step` to prevent accidental loss of contract ownership due to typo in transfer address.

2. **Add Rate Limiting & Web Application Firewall:**
   - Protect `/api/auth/login` and `/api/auth/register` against brute-force and credential stuffing attacks using `express-rate-limit` and `helmet`.

3. **Enhance Secret & Key Management:**
   - Eliminate hard-coded fallback strings in `jwt.sign` and `jwt.verify`.
   - Never store smart contract deployer private keys in plaintext files. Use hardware security modules (HSM) or cloud KMS.

4. **Continuous Vulnerability Scanning:**
   - Integrate automated SAST (Static Application Security Testing) and dependency scanning (Dependabot, Snyk) into the CI/CD pipeline.

---

## 5. Conclusion

The Major R application demonstrates **strong adherence to secure coding standards** for its current architecture. Role-based access control, cryptographic password hashing, data leakage prevention, and transaction verification operate as designed without regressions. Addressing the limitations outlined above will transition the platform toward full production readiness.
