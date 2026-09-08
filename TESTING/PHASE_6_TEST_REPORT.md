# Phase 6: IPFS Document Storage Test Report

This report documents the verification results of **Phase 6: IPFS Document Storage** for the major_r application, executed using the E2E verification test runner `backend/verify_phase_6.mjs`.

## Test Case Summary

- **Total tests**: 10
- **Passed**: 10
- **Failed**: 0
- **Blocked**: 0

---

## Test Cases Detailed Results

### TC-1 — Upload valid PDF

- **Test ID**: TC-1
- **Test Description**: Upload a valid PDF document to a project campaign owned by the authenticated NGO.
- **Preconditions**: NGO logged in, campaign project registered.
- **Steps performed**:
  1. Construct FormData containing project ID and a PDF file attachment.
  2. Send POST request to `/api/documents` with NGO's auth token.
- **Expected result**: Upload succeeds, returns HTTP 201, and returns a valid IPFS CID.
- **Actual result**: Deployed mock IPFS CID starting with `Qm...` returned with HTTP 201.
- **Status**: PASS

---

### TC-2 — Upload unsupported file type

- **Test ID**: TC-2
- **Test Description**: Verify that files with unsupported mimetypes (e.g. `.txt`) are rejected.
- **Preconditions**: NGO logged in, campaign project registered.
- **Steps performed**:
  1. Construct FormData with project ID and a text file (`.txt`) attachment.
  2. Send POST request to `/api/documents`.
- **Expected result**: Upload is rejected with HTTP 400 Bad Request.
- **Actual result**: Server returned HTTP 400 Bad Request indicating that only PDF and image types are supported.
- **Status**: PASS

---

### TC-3 — Upload without file

- **Test ID**: TC-3
- **Test Description**: Verify that submitting a document upload request without attaching a file is rejected.
- **Preconditions**: NGO logged in, campaign project registered.
- **Steps performed**:
  1. Send POST request to `/api/documents` without appending a file boundary.
- **Expected result**: Request is rejected with HTTP 400 Bad Request.
- **Actual result**: Returned HTTP 400 Bad Request indicating missing file payloads.
- **Status**: PASS

---

### TC-4 — Unauthorized donor attempts upload

- **Test ID**: TC-4
- **Test Description**: Verify that a user with the DONOR role is blocked from uploading documents.
- **Preconditions**: Donor user logged in.
- **Steps performed**:
  1. Send POST request to `/api/documents` with Donor's auth token.
- **Expected result**: Request rejected with HTTP 403 Forbidden.
- **Actual result**: Access check interceptor returns HTTP 403 Forbidden.
- **Status**: PASS

---

### TC-5 — NGO uploads document to another NGO's project

- **Test ID**: TC-5
- **Test Description**: Verify that an NGO is blocked from uploading files to a project belonging to a different NGO.
- **Preconditions**: NGO 1 logged in, Project 2 belonging to NGO 2 exists.
- **Steps performed**:
  1. Send POST request to `/api/documents` with NGO 1's token and Project 2's ID.
- **Expected result**: Request is rejected with HTTP 403 Forbidden.
- **Actual result**: Ownership controller checks ngoId and rejects request with HTTP 403 Forbidden.
- **Status**: PASS

---

### TC-6 — CID is stored correctly in MongoDB

- **Test ID**: TC-6
- **Test Description**: Verify that the generated IPFS CID is archived in MongoDB.
- **Preconditions**: Successful upload performed (TC-1).
- **Steps performed**:
  1. Query database records directly using Mongoose Document model.
- **Expected result**: Database metadata contains the generated IPFS CID.
- **Actual result**: Confirmed that the `Document` Mongoose document contains `ipfsCid` matching the upload response CID.
- **Status**: PASS

---

### TC-7 — Retrieve document using stored CID

- **Test ID**: TC-7
- **Test Description**: Verify that the uploaded document can be downloaded/retrieved from IPFS using its CID.
- **Preconditions**: Document uploaded to IPFS.
- **Steps performed**:
  1. Request `GET /api/documents/:cid/download`.
  2. Inspect response content-type headers and binary body stream.
- **Expected result**: Returns HTTP 200, matching Content-Type header, and matching contents.
- **Actual result**: Returned HTTP 200 OK, `Content-Type: application/pdf`, and matching file stream (`%PDF-1.4 mock content`).
- **Status**: PASS

---

### TC-8 — Delete/remove document metadata (uploader authorization enforced)

- **Test ID**: TC-8
- **Test Description**: Verify uploader authorization checks during file deletion.
- **Preconditions**: Document uploaded by NGO 1.
- **Steps performed**:
  1. Attempt deletion of document using NGO 2's token. (Expected: HTTP 403)
  2. Attempt deletion of document using NGO 1's token. (Expected: HTTP 200)
  3. Query database to confirm deletion.
- **Expected result**: Unauthorized delete fails; authorized delete succeeds and removes database metadata and cached file.
- **Actual result**: NGO 2 request returns HTTP 403 Forbidden. NGO 1 request returns HTTP 200 OK, clearing Mongoose metadata.
- **Status**: PASS

---

### TC-9 — IPFS service unavailable

- **Test ID**: TC-9
- **Test Description**: Verify that if the IPFS service is offline, the upload fails without writing a false metadata record to MongoDB.
- **Preconditions**: Backend started with simulated offline IPFS daemon environment.
- **Steps performed**:
  1. Trigger document upload POST request.
  2. Query MongoDB database for any saved document records.
- **Expected result**: Upload fails (reports server-side failure) and MongoDB remains completely clean.
- **Actual result**: Request failed (HTTP 500) and no Mongoose document record was stored in MongoDB.
- **Status**: PASS

---

### TC-10 — Verify no large document content is stored directly in MongoDB

- **Test ID**: TC-10
- **Test Description**: Verify that no large binary document buffers or contents are stored in MongoDB.
- **Preconditions**: Document uploaded.
- **Steps performed**:
  1. Inspect Mongoose record schema attributes.
- **Expected result**: Database only persists metadata keys; content is stored exclusively on IPFS.
- **Actual result**: Database holds only `_id`, `projectId`, `uploadedBy`, `fileName`, `mimeType`, and `ipfsCid`. No binary data or content fields are persisted.
- **Status**: PASS
