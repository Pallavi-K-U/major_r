# Phase 3: NGO and Project Management Test Report

This report documents the verification results of **Phase 3: NGO and Project Management** for the major_r application, executed using a finite test runner `backend/verify_phase_3.mjs`.

## Test Case Summary

- **Total tests**: 13 (12 Functional test cases + 1 Database Persistence test)
- **Passed**: 13
- **Failed**: 0
- **Blocked**: 0

---

## Test Cases Detailed Results

### TC-1 — NGO creates valid project

- **Test ID**: TC-1
- **Test Description**: Create a new project with valid metadata and milestone distributions.
- **Preconditions**: NGO user is registered, profile exists.
- **Steps performed**:
  1. POST `/api/projects` with targetAmount 5000, start/end dates set to future windows, and 2 milestones summing to 5000.
- **Expected result**: Project successfully created, HTTP 201 status, returns project object.
- **Actual result**: Campaign created successfully, HTTP 201 returned, milestones correctly stored in response object.
- **Status**: PASS

---

### TC-2 — NGO creates project with missing title

- **Test ID**: TC-2
- **Test Description**: Attempt to create a project without a title field.
- **Preconditions**: NGO user authenticated.
- **Steps performed**:
  1. POST `/api/projects` omitting `title` field.
- **Expected result**: Request rejected, HTTP 400 status.
- **Actual result**: Request rejected, HTTP 400 returned, message logs `Project title is required`.
- **Status**: PASS

---

### TC-3 — NGO creates project with targetAmount <= 0

- **Test ID**: TC-3
- **Test Description**: Attempt to create a project with a target amount of 0 or negative.
- **Preconditions**: NGO user authenticated.
- **Steps performed**:
  1. POST `/api/projects` with `targetAmount: 0`.
- **Expected result**: Request rejected, HTTP 400 status.
- **Actual result**: Request rejected, HTTP 400 returned, message logs `Target amount must be greater than zero`.
- **Status**: PASS

---

### TC-4 — NGO creates project with invalid dates

- **Test ID**: TC-4
- **Test Description**: Attempt to create a project where the end date precedes the start date.
- **Preconditions**: NGO user authenticated.
- **Steps performed**:
  1. POST `/api/projects` with `startDate: 2026-12-31` and `endDate: 2026-09-01`.
- **Expected result**: Request rejected, HTTP 400 status.
- **Actual result**: Request rejected, HTTP 400 returned, message logs `End date must be strictly after the start date`.
- **Status**: PASS

---

### TC-5 — NGO creates project with invalid milestone amounts

- **Test ID**: TC-5
- **Test Description**: Attempt to create a project where the sum of milestones does not equal the target amount.
- **Preconditions**: NGO user authenticated.
- **Steps performed**:
  1. POST `/api/projects` with targetAmount 1000, and milestones summing to 1500.
- **Expected result**: Request rejected, HTTP 400 status.
- **Actual result**: Request rejected, HTTP 400 returned, message logs `The sum of milestone amounts must exactly equal the project target amount`.
- **Status**: PASS

---

### TC-6 — DONOR attempts to create project

- **Test ID**: TC-6
- **Test Description**: Verify that users with the `DONOR` role are forbidden from creating project campaigns.
- **Preconditions**: Donor user authenticated.
- **Steps performed**:
  1. POST `/api/projects` with donor authorization token.
- **Expected result**: Request rejected, HTTP 403 Forbidden.
- **Actual result**: Rejected, returns HTTP 403 Forbidden.
- **Status**: PASS

---

### TC-7 — NGO attempts to modify another NGO's project

- **Test ID**: TC-7
- **Test Description**: Verify that an NGO cannot modify campaigns owned by other organizations.
- **Preconditions**: NGO 1 and NGO 2 registered, NGO 1 owns a campaign.
- **Steps performed**:
  1. PUT `/api/projects/:ngo1ProjectId` with NGO 2's authorization token.
- **Expected result**: Request rejected, HTTP 403 Forbidden.
- **Actual result**: Rejected, returns HTTP 403 Forbidden.
- **Status**: PASS

---

### TC-8 — DONOR views active project

- **Test ID**: TC-8
- **Test Description**: Verify that a donor can fetch active project campaign details.
- **Preconditions**: Donor user authenticated, active project exists.
- **Steps performed**:
  1. GET `/api/projects/:projectId` with donor token.
- **Expected result**: Project details returned, HTTP 200 status.
- **Actual result**: Project details returned successfully with HTTP 200.
- **Status**: PASS

---

### TC-9 — Project with DRAFT status

- **Test ID**: TC-9
- **Test Description**: Verify that campaigns in DRAFT status are not returned in public active campaign lists.
- **Preconditions**: Project created in DRAFT status.
- **Steps performed**:
  1. GET `/api/projects/active`.
  2. Scan results to verify the draft project is absent.
- **Expected result**: Draft project is not presented in the active listings.
- **Actual result**: Verified that only ACTIVE campaigns are returned; draft campaign is excluded.
- **Status**: PASS

---

### TC-10 — ADMIN verifies NGO

- **Test ID**: TC-10
- **Test Description**: Verify that an ADMIN user can verify NGO profile documents.
- **Preconditions**: Admin user authenticated, unverified NGO profile exists.
- **Steps performed**:
  1. PUT `/api/admin/ngos/:ngoProfileId/verify` with admin token.
- **Expected result**: NGO verification status updated to `verified: true`, HTTP 200 status.
- **Actual result**: Profile successfully verified, HTTP 200 returned, `verified` attribute is set to `true`.
- **Status**: PASS

---

### TC-11 — Unauthorized user attempts admin verification

- **Test ID**: TC-11
- **Test Description**: Verify that non-admin users cannot trigger NGO verification.
- **Preconditions**: Donor user authenticated.
- **Steps performed**:
  1. PUT `/api/admin/ngos/:ngoProfileId/verify` with donor token.
- **Expected result**: Request rejected, HTTP 403 Forbidden.
- **Actual result**: Rejected, returns HTTP 403 Forbidden.
- **Status**: PASS

---

### TC-12 — Project retrieval returns correct NGO and milestone information

- **Test ID**: TC-12
- **Test Description**: Verify that querying project details embeds the corresponding NGO profile and embedded milestones list.
- **Preconditions**: Project and NGO profile records exist.
- **Steps performed**:
  1. GET `/api/projects/:projectId`.
- **Expected result**: Details successfully joined, HTTP 200 returned.
- **Actual result**: Returned details contain populated `ngoDetails` name and nested `milestones` array elements.
- **Status**: PASS

---

### DATABASE TEST — Verify project and NGO data are persisted correctly in MongoDB

- **Test ID**: DB-TEST
- **Test Description**: Directly query MongoDB via Mongoose to verify that campaign and profile documents are saved and read correctly.
- **Preconditions**: Projects and NGO profiles created/updated in the database.
- **Steps performed**:
  1. Directly connect via Mongoose models.
  2. Run `Project.findById` and check title.
  3. Run `NgoProfile.findById` and check verified status.
- **Expected result**: Data records found in database, properties match expected states.
- **Actual result**: Records successfully resolved. Project title matched `Save the RainForest` and NGO Profile verified status resolved to `true`.
- **Status**: PASS
