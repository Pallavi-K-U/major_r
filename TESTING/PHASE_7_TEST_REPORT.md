# Phase 7: Fraud Detection AI Training Pipeline Test Report

This report documents the verification results of **Phase 7: Fraud Detection AI Training Pipeline** for the major_r application, executed using the E2E verification test runner `ai/verify_phase_7.py`.

## Test Case Summary

- **Total tests**: 24
- **Passed**: 24
- **Failed**: 0
- **Blocked**: 0

---

## Test Cases Detailed Results

### TC-1 — Dataset exists and loads successfully

- **Test ID**: TC-1
- **Test Description**: Verify that the actual PaySim CSV dataset exists at `ai/data/paysim.csv` and loads successfully.
- **Preconditions**: PaySim CSV placed in correct directory.
- **Steps performed**:
  1. Check file existence.
  2. Load headers and check for `isFraud` column.
- **Expected result**: `paysim.csv` exists and schema is loaded.
- **Actual result**: `paysim.csv` loads successfully and schema contains required columns.
- **Status**: PASS

---

### TC-2 — Dataset file is missing

- **Test ID**: TC-2
- **Test Description**: Verify that training fails with a clear error when the dataset file is missing.
- **Preconditions**: Dataset file moved or hidden.
- **Steps performed**:
  1. Rename `paysim.csv` to `paysim.csv.tmp`.
  2. Trigger file check function.
  3. Restore `paysim.csv`.
- **Expected result**: Clear error triggered; no fake data is generated.
- **Actual result**: The script exits immediately reporting missing files without fabricating data.
- **Status**: PASS

---

### TC-3 — Dataset is corrupted/unreadable

- **Test ID**: TC-3
- **Test Description**: Verify that corrupted or unreadable files are rejected with a clear error.
- **Preconditions**: Bad file created temporarily.
- **Steps performed**:
  1. Create a non-CSV text file under `paysim.csv`.
  2. Trigger file parsing.
  3. Restore original CSV.
- **Expected result**: Throws format or parse exceptions.
- **Actual result**: Parsing fails with a CSV parse exception.
- **Status**: PASS

---

### TC-4 — Target column is missing

- **Test ID**: TC-4
- **Test Description**: Verify that training stops with an error if target column `isFraud` is missing.
- **Preconditions**: Training initiated.
- **Steps performed**:
  1. Load a mocked dataframe without `isFraud` column.
  2. Pass it to target verification.
- **Expected result**: Training halts with clear target missing message.
- **Actual result**: Halts with missing target column error message.
- **Status**: PASS

---

### TC-5 — Target contains unexpected values

- **Test ID**: TC-5
- **Test Description**: Verify that non-binary target values trigger validation errors.
- **Preconditions**: Training initiated.
- **Steps performed**:
  1. Load a mocked dataframe with `isFraud` values containing `2`.
  2. Perform target content checks.
- **Expected result**: Request halts, reporting non-binary values.
- **Actual result**: Verification logic correctly identifies non-subset values.
- **Status**: PASS

---

### TC-6 — Class distribution is calculated

- **Test ID**: TC-6
- **Test Description**: Verify that fraud/non-fraud transaction counts and percentages are calculated and reported.
- **Preconditions**: Data loaded.
- **Steps performed**:
  1. Run class value count aggregations.
- **Expected result**: Distribution values mapped.
- **Actual result**: Reported: Fraud=8,213 (0.1291%), Non-Fraud=6,354,407.
- **Status**: PASS

---

### TC-7 — Train/test split succeeds

- **Test ID**: TC-7
- **Test Description**: Verify that both classes are represented in train and test sets under time-aware splits.
- **Preconditions**: Time holdout split configured on `step = 600`.
- **Steps performed**:
  1. Slice dataframe on step boundary and check labels.
- **Expected result**: Train and test partitions contain both classes.
- **Actual result**: Train fraud count is 6,613; test fraud count is 1,600.
- **Status**: PASS

---

### TC-8 — Preprocessing pipeline trains successfully

- **Test ID**: TC-8
- **Test Description**: Verify that ColumnTransformer fits numeric scales and hot encodings.
- **Preconditions**: Data split completed.
- **Steps performed**:
  1. Run `preprocessor.fit(X_train)`.
- **Expected result**: ColumnTransformer trains successfully.
- **Actual result**: Preprocessing pipeline fitted without warnings or exceptions.
- **Status**: PASS

---

### TC-9 — Logistic Regression trains successfully

- **Test ID**: TC-9
- **Test Description**: Verify that Logistic Regression fits the training data.
- **Preconditions**: Data split and preprocessor configured.
- **Steps performed**:
  1. Fit Logistic Regression pipeline on X_train.
- **Expected result**: Fitting completes successfully.
- **Actual result**: Fitting succeeded in 1000 max iterations.
- **Status**: PASS

---

### TC-10 — Random Forest trains successfully

- **Test ID**: TC-10
- **Test Description**: Verify that Random Forest fits training data.
- **Preconditions**: Data split and preprocessor configured.
- **Steps performed**:
  1. Fit Random Forest pipeline with 100 estimators.
- **Expected result**: Fitting completes successfully.
- **Actual result**: Fitting succeeded with multi-threaded estimators.
- **Status**: PASS

---

### TC-11 — Evaluation metrics are generated

- **Test ID**: TC-11
- **Test Description**: Verify that precision, recall, F1, ROC-AUC, and confusion matrix are generated.
- **Preconditions**: Validation predictions completed.
- **Steps performed**:
  1. Run classification report metrics.
- **Expected result**: Metrics are printed and archived in reports.
- **Actual result**: File `ai/reports/model_evaluation_report.md` generated with all metrics.
- **Status**: PASS

---

### TC-12 — Final model is selected

- **Test ID**: TC-12
- **Test Description**: Verify that model selection is executed based on F1 performance metrics.
- **Preconditions**: Models evaluated.
- **Steps performed**:
  1. Select pipeline with highest validation F1.
- **Expected result**: Best model pipeline selected.
- **Actual result**: Random Forest (validation F1: 0.3911) selected over Logistic Regression.
- **Status**: PASS

---

### TC-13 — Saved joblib model exists

- **Test ID**: TC-13
- **Test Description**: Verify that joblib model is serialized under `ai/models/`.
- **Preconditions**: Pipeline completed.
- **Steps performed**:
  1. Save model via `joblib.dump()`.
- **Expected result**: File exists in destination directory.
- **Actual result**: File `ai/models/fraud_detection_model.joblib` exists.
- **Status**: PASS

---

### TC-14 — Saved model loads successfully

- **Test ID**: TC-14
- **Test Description**: Verify that the saved model can be loaded back into a fresh Python process.
- **Preconditions**: Model file serialized.
- **Steps performed**:
  1. Execute `joblib.load()`.
- **Expected result**: Model loads and retrieves dictionary parameters.
- **Actual result**: Re-loaded successfully, pulling pipeline, threshold, and feature configurations.
- **Status**: PASS

---

### TC-15 — Inference with valid feature input succeeds

- **Test ID**: TC-15
- **Test Description**: Verify that inference with valid features returns classification risks.
- **Preconditions**: Model loaded.
- **Steps performed**:
  1. Pass valid transaction dictionary to `predict()`.
- **Expected result**: Returns prediction, probability score, and risk level.
- **Actual result**: Returned: `{'prediction': 0, 'probability': 0.0, 'risk_level': 'LOW'}`.
- **Status**: PASS

---

### TC-16 — Inference with missing required feature

- **Test ID**: TC-16
- **Test Description**: Verify that missing required features triggers validation errors.
- **Preconditions**: Model loaded.
- **Steps performed**:
  1. Pass transaction input missing the `amount` key.
- **Expected result**: Throws `ValueError`.
- **Actual result**: Correctly triggers: `ValueError: Validation Error: Missing required feature column 'amount'`.
- **Status**: PASS

---

### TC-17 — Inference with invalid feature type

- **Test ID**: TC-17
- **Test Description**: Verify that invalid data types (e.g. non-numeric step) trigger validation errors.
- **Preconditions**: Model loaded.
- **Steps performed**:
  1. Pass transaction with `"invalid_step_string"`.
- **Expected result**: Throws `TypeError`.
- **Actual result**: Correctly triggers: `TypeError: Validation Error: Feature 'step' must be a numeric value`.
- **Status**: PASS

---

### TC-18 — Inference without the original training CSV

- **Test ID**: TC-18
- **Test Description**: Verify that inference does not depend on the original training CSV.
- **Preconditions**: Model loaded.
- **Steps performed**:
  1. Hide `paysim.csv` temporarily.
  2. Run inference request.
- **Expected result**: Inference completes successfully.
- **Actual result**: Inference executes successfully using only joblib file.
- **Status**: PASS

---

### TC-19 — Known test samples are passed to inference

- **Test ID**: TC-19
- **Test Description**: Verify that risk level outputs match LOW/MEDIUM/HIGH criteria.
- **Preconditions**: Model loaded.
- **Steps performed**:
  1. Inspect risk label ranges.
- **Expected result**: Returns correct classification risk labels.
- **Actual result**: Outputs are mapped correctly to valid risk labels.
- **Status**: PASS

---

### TC-20 — Verify `isFraud` is NOT included in model input features

- **Test ID**: TC-20
- **Test Description**: Verify target leakage prevention by ensuring `isFraud` is not a feature.
- **Preconditions**: Model loaded.
- **Steps performed**:
  1. Inspect `detector.features`.
- **Expected result**: `isFraud` is absent from feature list.
- **Actual result**: Confirmed `isFraud` is not in model features list.
- **Status**: PASS

---

### TC-21 — Verify the excluded balance fields are NOT used by the primary model

- **Test ID**: TC-21
- **Test Description**: Verify that balance fields are not utilized by the primary model.
- **Preconditions**: Model loaded.
- **Steps performed**:
  1. Inspect model feature metadata.
- **Expected result**: Balance-related features are absent.
- **Actual result**: Confirmed that `oldbalanceOrg`, `newbalanceOrig`, `oldbalanceDest`, and `newbalanceDest` are excluded.
- **Status**: PASS

---

### TC-22 — Verify the original PaySim CSV remains unchanged

- **Test ID**: TC-22
- **Test Description**: Verify that the original dataset file size and contents are unmodified.
- **Preconditions**: Verification completed.
- **Steps performed**:
  1. Check file size of `ai/data/paysim.csv`.
- **Expected result**: File size matches original ~470.7 MB.
- **Actual result**: Size is confirmed as `470.67 MB`, matching original file properties.
- **Status**: PASS

---

### TC-23 — Run the training pipeline twice using the same configuration

- **Test ID**: TC-23
- **Test Description**: Verify reproducibility of metrics across multiple training runs.
- **Preconditions**: Data split and training configurations set.
- **Steps performed**:
  1. Run training pipeline twice.
  2. Compare metrics.
- **Expected result**: Metric scores match exactly.
- **Actual result**: Test F1-scores match exactly across runs: `0.3145` vs `0.3145`.
- **Status**: PASS

---

### TC-24 — Verify inference does not retrain the model

- **Test ID**: TC-24
- **Test Description**: Verify that inference uses the saved model directly without retraining.
- **Preconditions**: Model loaded.
- **Steps performed**:
  1. Check `predict()` codebase logic and run.
- **Expected result**: Predictions executed without training calls.
- **Actual result**: Confirmed that `predict()` executes predictions directly using the saved model pipeline.
- **Status**: PASS
