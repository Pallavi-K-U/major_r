# Phase 5B: Blockchain Integration Test Report

This report documents the verification results of **Phase 5B: Blockchain Integration** for the major_r application, executed using the E2E verification test runner `backend/verify_phase_5b.mjs`.

## Test Case Summary

- **Total tests**: 12
- **Passed**: 12
- **Failed**: 0
- **Blocked**: 0

---

## Test Cases Detailed Results

### TC-1 — Connect MetaMask

- **Test ID**: TC-1
- **Test Description**: Connect to MetaMask wallet, retrieve accounts, and verify that the active account address is displayed on the UI.
- **Preconditions**: Local blockchain node is active.
- **Steps performed**:
  1. Trigger MetaMask `eth_requestAccounts` connection.
  2. Inspect the returned account address.
- **Expected result**: Wallet connects successfully and displays a valid Ethereum address on the UI.
- **Actual result**: Successfully resolved active signer wallet address `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`.
- **Status**: PASS

---

### TC-2 — User rejects wallet connection

- **Test ID**: TC-2
- **Test Description**: Verify that the application handles user rejections during wallet connection gracefully.
- **Preconditions**: Connection request initiated.
- **Steps performed**:
  1. Simulate user rejecting the MetaMask permission pop-up.
- **Expected result**: Application handles rejection gracefully, catches the error, and does not crash.
- **Actual result**: Catches the rejection error string (`User rejected the request.`) and displays a non-blocking Web3 alert.
- **Status**: PASS

---

### TC-3 — Valid donation (MetaMask transaction requested)

- **Test ID**: TC-3
- **Test Description**: Verify that making a donation requests a transaction request to MetaMask.
- **Preconditions**: Donor logged in, campaign is ACTIVE, wallet connected.
- **Steps performed**:
  1. Trigger smart contract `donate(0)` calling signed with donation amount `2.0 ETH`.
- **Expected result**: Transaction signature is requested on MetaMask; transaction broadcasts successfully.
- **Actual result**: Transaction signed and broadcasted to local node successfully. Hash generated: `0xb5ae52d0d25cf517959378e468bc1a61b9ce460b034184e05e493c9d717bc0cd`.
- **Status**: PASS

---

### TC-4 — User rejects transaction

- **Test ID**: TC-4
- **Test Description**: Verify that if a user rejects the transaction signature on MetaMask, the application is not marked successful.
- **Preconditions**: Transaction signature requested.
- **Steps performed**:
  1. Simulate user cancelling the transaction in MetaMask (`ACTION_REJECTED`).
- **Expected result**: Transaction is aborted; database record is not falsely marked successful.
- **Actual result**: User rejection caught; backend API call is bypassed, and database records remain unchanged.
- **Status**: PASS

---

### TC-5 — Successful transaction (hash stored)

- **Test ID**: TC-5
- **Test Description**: Verify that when a transaction is successful, the hash is retrieved and stored in MongoDB.
- **Preconditions**: Transaction succeeds on-chain.
- **Steps performed**:
  1. Query transaction in MongoDB after successful E2E flow.
- **Expected result**: Transaction document in MongoDB contains correct blockchain transaction hash.
- **Actual result**: Transaction document stored with `transactionHash` matching on-chain transaction hash.
- **Status**: PASS

---

### TC-6 — Verify transaction exists on local blockchain

- **Test ID**: TC-6
- **Test Description**: Verify that the transaction stored in MongoDB exists on the local blockchain node.
- **Preconditions**: Transaction recorded in MongoDB.
- **Steps performed**:
  1. Call `provider.getTransactionReceipt(hash)` using stored hash value.
- **Expected result**: Receipt resolved on-chain, status is 1 (success).
- **Actual result**: Receipt resolved, status is verified as `1`.
- **Status**: PASS

---

### TC-7 — Verify MongoDB transaction references correct blockchain transaction

- **Test ID**: TC-7
- **Test Description**: Validate database-to-chain reference match.
- **Preconditions**: Transaction recorded in MongoDB.
- **Steps performed**:
  1. Cross-reference fields (`blockNumber`, `fromAddress`, `toAddress`, `gasUsed`) in Mongoose document with on-chain values.
- **Expected result**: Reference properties match exactly.
- **Actual result**: Block number, gas used, and sender addresses match exactly.
- **Status**: PASS

---

### TC-8 — Refresh application after successful donation

- **Test ID**: TC-8
- **Test Description**: Verify that refreshing the page maintains the recorded donation ledger status.
- **Preconditions**: Donation recorded in database.
- **Steps performed**:
  1. Query history listings to ensure contribution is persisted.
- **Expected result**: Persisted record is returned on page reload.
- **Actual result**: Persisted correctly in database; subsequent history list queries successfully return the transaction.
- **Status**: PASS

---

### TC-9 — Blockchain transaction failure

- **Test ID**: TC-9
- **Test Description**: Verify that failed on-chain transactions or invalid hashes are rejected by the backend.
- **Preconditions**: Invalid/failed transaction hash supplied.
- **Steps performed**:
  1. POST `/api/donations` with invalid transaction hash.
- **Expected result**: Request rejected, HTTP 400 status; database does not save transaction.
- **Actual result**: Request rejected, returns HTTP 400 with a detailed error indicating the hash was not found or failed on-chain.
- **Status**: PASS

---

### TC-10 — Wrong network

- **Test ID**: TC-10
- **Test Description**: Verify that connecting MetaMask to a wrong chain ID raises an error.
- **Preconditions**: Wallet connected to wrong network (e.g. Chain ID 1).
- **Steps performed**:
  1. Request donation or project creation.
- **Expected result**: Front-end checks chainId against config (`31337`), blocks transaction, and displays a network mismatch error.
- **Actual result**: Chain check fails; transaction is blocked, and user is warned to connect to Hardhat Local Node.
- **Status**: PASS

---

### TC-11 — Verify donor can view transaction hash

- **Test ID**: TC-11
- **Test Description**: Verify that donors can view their contribution transaction hashes on their history dashboard.
- **Preconditions**: Contribution transaction recorded.
- **Steps performed**:
  1. GET `/api/donations/my` with donor token.
- **Expected result**: Returns transaction hash for completed donations.
- **Actual result**: Transaction records populated with corresponding `transactionHash` and returned to donor.
- **Status**: PASS

---

### TC-12 — Verify NGO/admin can view relevant blockchain transaction info

- **Test ID**: TC-12
- **Test Description**: Verify that NGO and Admin users can view transaction hashes and metadata.
- **Preconditions**: Donation recorded.
- **Steps performed**:
  1. GET `/api/ngo/donations` with NGO token.
  2. GET `/api/admin/transactions` with Admin token.
- **Expected result**: Returns audit metadata (blockNumber, fromAddress, gasUsed).
- **Actual result**: Returned listings contain populated on-chain audit parameters.
- **Status**: PASS
