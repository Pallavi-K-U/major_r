# Phase 2: Authentication and Role-Based Access Control Test Report

This report documents the verification results of **Phase 2: Authentication and Role-Based Access Control** for the major_r application, executed using a finite test runner `backend/verify_phase_2.mjs`.

## Test Case Summary

- **Total tests**: 19
- **Passed**: 19
- **Failed**: 0
- **Blocked**: 0

---

## Test Cases Detailed Results

### TC-1 — Register with valid donor data

- **Test ID**: TC-1
- **Test Description**: Register a new user with valid donor information.
- **Preconditions**: Backend server running, database active.
- **Steps performed**:
  1. POST `/api/auth/register` with `name`, `email: donor@test.com`, `password: password123`, `role: DONOR`.
- **Expected result**: Account created successfully, HTTP 201 response, `passwordHash` omitted from response user object.
- **Actual result**: Account created, HTTP 201 status, `role` matches `DONOR`, `passwordHash` is absent in response.
- **Status**: PASS

---

### TC-2 — Register with valid NGO data

- **Test ID**: TC-2
- **Test Description**: Register a new user with valid NGO information.
- **Preconditions**: Backend server running, database active.
- **Steps performed**:
  1. POST `/api/auth/register` with `name`, `email: ngo@test.com`, `password: password123`, `role: NGO`.
- **Expected result**: NGO account created successfully, HTTP 201 response.
- **Actual result**: NGO account created, HTTP 201 status, `role` matches `NGO`.
- **Status**: PASS

---

### TC-3 — Register with duplicate email

- **Test ID**: TC-3
- **Test Description**: Attempt to register an account using an email that is already registered.
- **Preconditions**: An account with `donor@test.com` is already registered.
- **Steps performed**:
  1. POST `/api/auth/register` with duplicate email `donor@test.com`.
- **Expected result**: Request rejected with HTTP 400.
- **Actual result**: Rejected with HTTP 400, body logs `Email is already registered`.
- **Status**: PASS

---

### TC-4 — Register with invalid email

- **Test ID**: TC-4
- **Test Description**: Attempt to register with a syntactically invalid email format.
- **Preconditions**: Backend server running.
- **Steps performed**:
  1. POST `/api/auth/register` with email `invalidemail`.
- **Expected result**: Request rejected with HTTP 400.
- **Actual result**: Rejected with HTTP 400, body logs `Invalid email format`.
- **Status**: PASS

---

### TC-5 — Register with missing required fields

- **Test ID**: TC-5
- **Test Description**: Attempt to register with missing required parameters (e.g. missing `name`).
- **Preconditions**: Backend server running.
- **Steps performed**:
  1. POST `/api/auth/register` with email, password, and role but missing `name`.
- **Expected result**: Request rejected with HTTP 400.
- **Actual result**: Rejected with HTTP 400, body logs `Missing required registration fields`.
- **Status**: PASS

---

### TC-6 — Register with weak/invalid password

- **Test ID**: TC-6
- **Test Description**: Attempt to register with a password shorter than 8 characters.
- **Preconditions**: Backend server running.
- **Steps performed**:
  1. POST `/api/auth/register` with `password: 123`.
- **Expected result**: Request rejected with HTTP 400.
- **Actual result**: Rejected with HTTP 400, body logs `Password must be at least 8 characters long`.
- **Status**: PASS

---

### TC-7 — Login with correct credentials

- **Test ID**: TC-7
- **Test Description**: Login to registered donor, NGO, and seeded admin accounts using valid credentials.
- **Preconditions**: Accounts created/seeded.
- **Steps performed**:
  1. POST `/api/auth/login` for donor, NGO, and admin.
- **Expected result**: Successful authentication (HTTP 200), JWT tokens returned.
- **Actual result**: Login succeeded with HTTP 200, valid JWT tokens returned for all three roles.
- **Status**: PASS

---

### TC-8 — Login with incorrect password

- **Test ID**: TC-8
- **Test Description**: Attempt to authenticate with a correct email but an incorrect password.
- **Preconditions**: Account exists.
- **Steps performed**:
  1. POST `/api/auth/login` with `email: donor@test.com` and `password: wrongpassword`.
- **Expected result**: Authentication rejected with HTTP 401.
- **Actual result**: Rejected with HTTP 401, body logs `Invalid email or password`.
- **Status**: PASS

---

### TC-9 — Login with nonexistent email

- **Test ID**: TC-9
- **Test Description**: Attempt to authenticate using an email address that does not exist in the database.
- **Preconditions**: Email does not exist.
- **Steps performed**:
  1. POST `/api/auth/login` with `email: nonexistent@test.com` and `password: password123`.
- **Expected result**: Authentication rejected with HTTP 401.
- **Actual result**: Rejected with HTTP 401.
- **Status**: PASS

---

### TC-10 — Logout

- **Test ID**: TC-10
- **Test Description**: Verify that logging out (clearing token) prevents protected API access.
- **Preconditions**: Client has no token.
- **Steps performed**:
  1. Call GET `/api/donor/dashboard` without setting Authorization headers.
- **Expected result**: Access denied, request rejected with HTTP 401.
- **Actual result**: Rejected with HTTP 401 Unauthorized.
- **Status**: PASS

---

### TC-11 — DONOR accesses donor functionality

- **Test ID**: TC-11
- **Test Description**: Verify that a user with the `DONOR` role can access donor-restricted endpoints.
- **Preconditions**: Valid donor token acquired.
- **Steps performed**:
  1. GET `/api/donor/dashboard` with header `Authorization: Bearer <donorToken>`.
- **Expected result**: Allowed, returns HTTP 200.
- **Actual result**: Allowed, returns HTTP 200 and success response.
- **Status**: PASS

---

### TC-12 — NGO accesses NGO functionality

- **Test ID**: TC-12
- **Test Description**: Verify that a user with the `NGO` role can access NGO-restricted endpoints.
- **Preconditions**: Valid NGO token acquired.
- **Steps performed**:
  1. GET `/api/ngo/dashboard` with header `Authorization: Bearer <ngoToken>`.
- **Expected result**: Allowed, returns HTTP 200.
- **Actual result**: Allowed, returns HTTP 200 and success response.
- **Status**: PASS

---

### TC-13 — ADMIN accesses admin functionality

- **Test ID**: TC-13
- **Test Description**: Verify that a user with the `ADMIN` role can access admin-restricted endpoints.
- **Preconditions**: Admin user seeded and logged in, valid admin token acquired.
- **Steps performed**:
  1. GET `/api/admin/dashboard` with header `Authorization: Bearer <adminToken>`.
- **Expected result**: Allowed, returns HTTP 200.
- **Actual result**: Allowed, returns HTTP 200 and success response.
- **Status**: PASS

---

### TC-14 — DONOR accesses NGO-only endpoint

- **Test ID**: TC-14
- **Test Description**: Verify that a `DONOR` user is forbidden from accessing NGO-only endpoints.
- **Preconditions**: Valid donor token acquired.
- **Steps performed**:
  1. GET `/api/ngo/dashboard` with header `Authorization: Bearer <donorToken>`.
- **Expected result**: Request rejected with HTTP 403 Forbidden.
- **Actual result**: Rejected with HTTP 403 Forbidden.
- **Status**: PASS

---

### TC-15 — DONOR accesses ADMIN-only endpoint

- **Test ID**: TC-15
- **Test Description**: Verify that a `DONOR` user is forbidden from accessing ADMIN-only endpoints.
- **Preconditions**: Valid donor token acquired.
- **Steps performed**:
  1. GET `/api/admin/dashboard` with header `Authorization: Bearer <donorToken>`.
- **Expected result**: Request rejected with HTTP 403 Forbidden.
- **Actual result**: Rejected with HTTP 403 Forbidden.
- **Status**: PASS

---

### TC-16 — Unauthenticated user accesses protected endpoint

- **Test ID**: TC-16
- **Test Description**: Verify that unauthenticated requests to protected endpoints are blocked.
- **Preconditions**: No token provided.
- **Steps performed**:
  1. GET `/api/donor/dashboard` without authorization header.
- **Expected result**: Request rejected with HTTP 401 Unauthorized.
- **Actual result**: Rejected with HTTP 401 Unauthorized.
- **Status**: PASS

---

### TC-17 — Inspect database user record

- **Test ID**: TC-17
- **Test Description**: Verify that passwords are not stored in plaintext in the database, and that they use a secure hashing algorithm.
- **Preconditions**: User registered.
- **Steps performed**:
  1. Query database directly for the registered donor user.
  2. Inspect the value of `passwordHash`.
- **Expected result**: Plaintext password is not stored; password hash matches bcrypt prefix (`$2a$` or `$2b$`).
- **Actual result**: Plaintext is not stored. The `passwordHash` field holds the bcrypt hash value (starts with `$2b$`).
- **Status**: PASS

---

### TC-18 — Attempt public registration with role=ADMIN

- **Test ID**: TC-18
- **Test Description**: Attempt to assign `ADMIN` role to a user during public registration.
- **Preconditions**: Backend server running.
- **Steps performed**:
  1. POST `/api/auth/register` with `role: ADMIN`.
- **Expected result**: Request rejected with HTTP 400.
- **Actual result**: Rejected with HTTP 400, body logs `ADMIN role cannot be self-assigned through public registration`.
- **Status**: PASS

---

### TC-19 — Attempt to modify another user's protected information without authorization

- **Test ID**: TC-19
- **Test Description**: Attempt to update another user's profile info without ownership or ADMIN privileges.
- **Preconditions**: Donor and NGO accounts registered.
- **Steps performed**:
  1. Perform PUT `/api/users/:ngoId` with donor's authentication token.
- **Expected result**: Request rejected with HTTP 403 Forbidden.
- **Actual result**: Rejected with HTTP 403 Forbidden. (Subsequent owner check with NGO token succeeded with HTTP 200).
- **Status**: PASS
