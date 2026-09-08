# Phase 5A: Blockchain Smart-Contract Layer Test Report

This report documents the verification results of **Phase 5A: Blockchain Smart-Contract Layer** for the major_r application, executed using the Hardhat Mocha test runner `npx hardhat test` in the `blockchain/` directory.

## Test Case Summary

- **Total tests**: 15 (14 Functional test cases + 1 Extra Validation test)
- **Passed**: 15
- **Failed**: 0
- **Blocked**: 0

---

## Test Cases Detailed Results

### TC-1 — Deploy contract

- **Test ID**: TC-1
- **Test Description**: Deploy the `NGOFundManager` contract on a local Hardhat network and verify that it initializes with the deployer set as the owner.
- **Preconditions**: Solidity contract compiled, Hardhat network active.
- **Steps performed**:
  1. Deploy the `NGOFundManager` contract using `ethers.getContractFactory`.
  2. Call `owner()` view function on the deployed contract instance.
- **Expected result**: Deployment succeeds and owner address matches the deployer's address.
- **Actual result**: Deployed successfully. Owner matches address `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`.
- **Status**: PASS

---

### TC-2 — Create valid project

- **Test ID**: TC-2
- **Test Description**: Register a valid project on-chain with target and milestone inputs.
- **Preconditions**: Contract deployed.
- **Steps performed**:
  1. Call `createProject(ngoAddress, targetAmount=5.0 ETH, titles=["M1", "M2"], amounts=[2.0 ETH, 3.0 ETH])`.
  2. Inspect the project data struct in contract storage.
- **Expected result**: Project successfully stored with correct parameters (`ngo`, `targetAmount`, `raisedAmount=0`, `releasedAmount=0`, `active=true`).
- **Actual result**: Stored correctly with matching target, NGO address, and active state.
- **Status**: PASS

---

### TC-3 — Create project with invalid parameters

- **Test ID**: TC-3
- **Test Description**: Verify that project registration reverts when parameters are invalid.
- **Preconditions**: Contract deployed.
- **Steps performed**:
  1. Attempt project creation with milestone amounts summing to `4.9 ETH` but target amount of `5.0 ETH`.
  2. Attempt project creation with mismatching sizes for titles and amounts arrays.
- **Expected result**: Transactions revert with clear reason strings.
- **Actual result**: Reverted with `Milestone sum must equal target` and `Milestone mismatch`.
- **Status**: PASS

---

### TC-4 — Valid donation

- **Test ID**: TC-4
- **Test Description**: Verify that sending an Ether donation to an active project updates balance accounting.
- **Preconditions**: Project created and active.
- **Steps performed**:
  1. Send a transaction calling `donate(0)` with value `2.5 ETH` from a donor account.
  2. Read the project raisedAmount and total contract balance.
- **Expected result**: Contract balance increases by 2.5 ETH; project `raisedAmount` updates to 2.5 ETH.
- **Actual result**: Project raisedAmount updated to 2.5 ETH; contract balance updated to 2.5 ETH.
- **Status**: PASS

---

### TC-5 — Zero-value donation

- **Test ID**: TC-5
- **Test Description**: Verify that sending a donation of 0 ETH is rejected.
- **Preconditions**: Project created and active.
- **Steps performed**:
  1. Call `donate(0)` with value `0 ETH`.
- **Expected result**: Transaction reverts with `Donation must be > 0`.
- **Actual result**: Reverted with `Donation must be > 0`.
- **Status**: PASS

---

### TC-6 — Unauthorized project administration action

- **Test ID**: TC-6
- **Test Description**: Verify that non-owner accounts cannot execute admin functions like toggling project status.
- **Preconditions**: Project created.
- **Steps performed**:
  1. Connect a third-party account and call `setProjectStatus(0, false)`.
- **Expected result**: Transaction reverts with `Caller is not the owner`.
- **Actual result**: Reverted with `Caller is not the owner`.
- **Status**: PASS

---

### TC-7 — Create valid milestone

- **Test ID**: TC-7
- **Test Description**: Verify that milestones nested inside projects are stored accurately.
- **Preconditions**: Project created with milestones.
- **Steps performed**:
  1. Call `getMilestoneDetails(0, 1)` to fetch the details of the second milestone.
- **Expected result**: Details successfully returned, matching initial allocation and `released=false`.
- **Actual result**: Returned matching milestone title, amount (3.0 ETH), and `released: false`.
- **Status**: PASS

---

### TC-8 — Unauthorized milestone fund release

- **Test ID**: TC-8
- **Test Description**: Verify that non-admin accounts cannot trigger milestone fund releases.
- **Preconditions**: Project created, funded with 5.0 ETH.
- **Steps performed**:
  1. Connect a third-party account and call `releaseMilestone(0, 0)`.
- **Expected result**: Transaction reverts with `Caller is not the owner`.
- **Actual result**: Reverted with `Caller is not the owner`.
- **Status**: PASS

---

### TC-9 — Authorized valid milestone release

- **Test ID**: TC-9
- **Test Description**: Verify that the owner can release milestone funds, transferring them to the NGO address.
- **Preconditions**: Project created, funded with 5.0 ETH.
- **Steps performed**:
  1. Call `releaseMilestone(0, 0)` from the owner account.
  2. Inspect NGO wallet balance change and milestone status.
- **Expected result**: NGO address balance increases by milestone amount (2.0 ETH), milestone marked as released.
- **Actual result**: NGO balance increased by 2.0 ETH; milestone `released` flag set to `true`.
- **Status**: PASS

---

### TC-10 — Release same milestone twice

- **Test ID**: TC-10
- **Test Description**: Verify that a milestone cannot be released more than once.
- **Preconditions**: Milestone 0 already released.
- **Steps performed**:
  1. Call `releaseMilestone(0, 0)` from the owner account a second time.
- **Expected result**: Transaction reverts with `Milestone already released`.
- **Actual result**: Reverted with `Milestone already released`.
- **Status**: PASS

---

### TC-11 — Release more funds than available

- **Test ID**: TC-11
- **Test Description**: Verify that a milestone cannot be released if the project has not raised sufficient funds.
- **Preconditions**: Project has raised only 3.0 ETH, Milestone 1 requires 5.0 ETH.
- **Steps performed**:
  1. Call `releaseMilestone(0, 0)`.
- **Expected result**: Transaction reverts with `Insufficient project funds`.
- **Actual result**: Reverted with `Insufficient project funds`.
- **Status**: PASS

---

### TC-12 — Invalid milestone ID

- **Test ID**: TC-12
- **Test Description**: Verify that trying to release a non-existent milestone ID reverts.
- **Preconditions**: Project has only 1 milestone (index 0).
- **Steps performed**:
  1. Call `releaseMilestone(0, 1)` (milestone at index 1 does not exist).
- **Expected result**: Transaction reverts with `Invalid milestone ID`.
- **Actual result**: Reverted with `Invalid milestone ID`.
- **Status**: PASS

---

### TC-13 — Verify emitted events

- **Test ID**: TC-13
- **Test Description**: Verify that all core operations broadcast the correct event names and arguments.
- **Preconditions**: Contract deployed.
- **Steps performed**:
  1. Monitor events for project creation, donation, and milestone release.
- **Expected result**: `ProjectCreated`, `DonationReceived`, and `MilestoneReleased` events emitted with correct parameters.
- **Actual result**: Events correctly emitted and match parameters.
- **Status**: PASS

---

### TC-14 — Verify contract balances after donation and release

- **Test ID**: TC-14
- **Test Description**: Track the actual contract address Ether balance after sequential donations and releases.
- **Preconditions**: Contract deployed.
- **Steps performed**:
  1. Inspect contract balance initially (0).
  2. Donate 4.0 ETH and inspect balance (4.0 ETH).
  3. Release 2.0 ETH milestone and inspect balance (2.0 ETH).
- **Expected result**: Balances match transactions exactly.
- **Actual result**: Initial balance: 0 ETH. Post-donation balance: 4.0 ETH. Post-release balance: 2.0 ETH.
- **Status**: PASS
