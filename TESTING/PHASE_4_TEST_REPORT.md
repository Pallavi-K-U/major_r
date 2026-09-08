# Phase 4: Basic Donation System Test Report

This report documents the verification results of **Phase 4: Basic Donation System** for the major_r application, executed using a finite test runner `backend/verify_phase_4.mjs`.

## Test Case Summary

- **Total tests**: 13
- **Passed**: 13
- **Failed**: 0
- **Blocked**: 0

---

## Test Cases Detailed Results

### TC-1 — Valid donation of ₹5,000 to active project

- **Test ID**: TC-1
- **Test Description**: Perform a valid contribution to an active campaign.
- **Preconditions**: Campaign is ACTIVE, donor is authenticated.
- **Steps performed**:
  1. POST `/api/donations` with `projectId: activeProj1`, `amount: 5000`, `idempotencyKey: key_tc1_unique_12345`.
- **Expected result**: Transaction created, HTTP 201 status, project `raisedAmount` increments by 5000.
- **Actual result**: Transaction successfully created, HTTP 201 status returned, project `raisedAmount` incremented to 5000.
- **Status**: PASS

---

### TC-2 — Donation amount = 0

- **Test ID**: TC-2
- **Test Description**: Attempt to donate a zero value.
- **Preconditions**: Campaign is ACTIVE, donor is authenticated.
- **Steps performed**:
  1. POST `/api/donations` with `amount: 0`.
- **Expected result**: Request rejected, HTTP 400 status.
- **Actual result**: Rejected, HTTP 400 returned, message logs `Donation amount must be greater than zero`.
- **Status**: PASS

---

### TC-3 — Negative donation

- **Test ID**: TC-3
- **Test Description**: Attempt to donate a negative value.
- **Preconditions**: Campaign is ACTIVE, donor is authenticated.
- **Steps performed**:
  1. POST `/api/donations` with `amount: -100`.
- **Expected result**: Request rejected, HTTP 400 status.
- **Actual result**: Rejected, HTTP 400 returned.
- **Status**: PASS

---

### TC-4 — Non-numeric donation

- **Test ID**: TC-4
- **Test Description**: Attempt to donate a non-numeric value (e.g., text).
- **Preconditions**: Campaign is ACTIVE, donor is authenticated.
- **Steps performed**:
  1. POST `/api/donations` with `amount: 'abc'`.
- **Expected result**: Request rejected, HTTP 400 status.
- **Actual result**: Rejected, HTTP 400 returned, message logs `Donation amount must be a valid numeric value`.
- **Status**: PASS

---

### TC-5 — Donation to nonexistent project

- **Test ID**: TC-5
- **Test Description**: Attempt to donate to a campaign ID that does not exist in the system.
- **Preconditions**: Donor is authenticated.
- **Steps performed**:
  1. POST `/api/donations` with random nonexistent project ObjectId.
- **Expected result**: Request rejected, HTTP 404 status.
- **Actual result**: Rejected, returns HTTP 404.
- **Status**: PASS

---

### TC-6 — Donation to DRAFT project

- **Test ID**: TC-6
- **Test Description**: Attempt to donate to a campaign that is in DRAFT status.
- **Preconditions**: Campaign created in DRAFT status, donor is authenticated.
- **Steps performed**:
  1. POST `/api/donations` targeting draft campaign ID.
- **Expected result**: Request rejected, HTTP 400 status.
- **Actual result**: Rejected, HTTP 400 returned, message logs `Donations are only allowed on ACTIVE projects`.
- **Status**: PASS

---

### TC-7 — Unauthenticated donation

- **Test ID**: TC-7
- **Test Description**: Verify that guests / unauthenticated users cannot donate.
- **Preconditions**: No authorization headers.
- **Steps performed**:
  1. POST `/api/donations` without token.
- **Expected result**: Request rejected, HTTP 401 Unauthorized status.
- **Actual result**: Rejected, returns HTTP 401 Unauthorized.
- **Status**: PASS

---

### TC-8 — NGO attempts to access donor-only donation functionality

- **Test ID**: TC-8
- **Test Description**: Verify that NGOs are forbidden from creating donations.
- **Preconditions**: NGO user authenticated.
- **Steps performed**:
  1. POST `/api/donations` with NGO authorization token.
- **Expected result**: Request rejected, HTTP 403 Forbidden status.
- **Actual result**: Rejected, returns HTTP 403 Forbidden.
- **Status**: PASS

---

### TC-9 — Donor views donation history

- **Test ID**: TC-9
- **Test Description**: Verify that donors can retrieve only their own transactions list.
- **Preconditions**: Donor 1 and Donor 2 have active transactions.
- **Steps performed**:
  1. GET `/api/donations/my` with Donor 1's token.
- **Expected result**: Returns only Donor 1's contributions.
- **Actual result**: Returned status 200 list contains only Donor 1's entries; Donor 2's contributions are excluded.
- **Status**: PASS

---

### TC-10 — NGO views received donations

- **Test ID**: TC-10
- **Test Description**: Verify that NGOs can view only donations directed to their campaigns.
- **Preconditions**: NGO 1 and NGO 2 have active projects and incoming contributions.
- **Steps performed**:
  1. GET `/api/ngo/donations` with NGO 1's token.
- **Expected result**: Returns only donations targeting campaigns owned by NGO 1.
- **Actual result**: Returned status 200 list contains only NGO 1 campaign records; NGO 2 entries are excluded.
- **Status**: PASS

---

### TC-11 — Admin views all transactions

- **Test ID**: TC-11
- **Test Description**: Verify that an admin can view all transaction logs.
- **Preconditions**: Admin user authenticated.
- **Steps performed**:
  1. GET `/api/admin/transactions` with admin token.
- **Expected result**: Complete list of all transactions across all campaigns and donors returned, HTTP 200.
- **Actual result**: Returned complete status 200 system transaction listings.
- **Status**: PASS

---

### TC-12 — Post-donation consistency checks

- **Test ID**: TC-12
- **Test Description**: Verify that following a donation, the transaction is logged, the project raises properly, and the donor sees it.
- **Preconditions**: Donation made in TC-1.
- **Steps performed**:
  1. Verify transaction document in DB.
  2. Inspect project `raisedAmount`.
  3. Inspect donor `/api/donations/my` endpoint results.
- **Expected result**: Transaction exists, campaign total updated, donor history updated.
- **Actual result**: Transaction exists, raisedAmount matches 5000, history contains transaction.
- **Status**: PASS

---

### TC-13 — Duplicate submission / Idempotency handling (Race Condition)

- **Test ID**: TC-13
- **Test Description**: Simulate a high-speed duplicate request (e.g. double click) with matching idempotency key.
- **Preconditions**: Donor authenticated.
- **Steps performed**:
  1. Fire two concurrent POST `/api/donations` calls with the same `idempotencyKey` simultaneously using `Promise.all`.
- **Expected result**: One request successfully writes transaction (returns 201), the other is handled gracefully by returning the cached winner transaction (returns 200), and `raisedAmount` increments only once.
- **Actual result**: One request returned 201, the other returned 200 (duplicate handled). Campaign raisedAmount increased by exactly 1000 (representing one contribution).
- **Status**: PASS
