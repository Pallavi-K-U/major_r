# Model Card: PaySim Transaction Fraud Detection Model

This model card documents the training, architecture, data validation, and leakage considerations of the machine learning classifier deployed for fraud detection on synthetic transaction datasets.

---

## 1. Model Details
- **Model Purpose**: To predict the probability and risk classification (LOW, MEDIUM, HIGH) of fraudulent financial transactions based on temporal, relational type, and value amount patterns.
- **Developer**: Antigravity
- **Date**: August 29, 2026
- **Algorithm Selected**: Random Forest Classifier
- **Selected Classification Threshold**: 0.40 (Tuned on validation subset to balance precision and recall)

---

## 2. Dataset Information
- **Dataset Name**: PaySim (Synthetic Financial Datasets for Fraud Detection)
- **Dataset Source**: Standard PaySim simulation dataset modeling mobile money transactions.
- **Dataset Size**: 6,362,620 rows, 11 columns, ~470.67 MB.
- **Class Imbalance**:
  - Non-Fraud (`isFraud = 0`): 6,354,407 (99.8709%)
  - Fraud (`isFraud = 1`): 8,213 (0.1291%)
  - Imbalance Ratio: 773.70:1

---

## 3. Disclaimers and Intended Use
> [!WARNING]
> **Synthetic Data Disclaimer**: PaySim is a synthetic financial transaction dataset and is NOT evidence of real NGO fraud patterns.
> The model demonstrates a fraud-detection methodology on PaySim data. It has not been validated on real NGO donation transactions.

- **Intended Use**: Analytical demo for time-aware local inference on mobile money or online transaction patterns to screen potential anomalies.
- **Non-intended Use**: Live deployment as a production fraud screening engine for real-world banking or NGO donation processing without model calibration and validation on real transaction data.

---

## 4. Preprocessing & Feature Selection

### Features Used
1. `step`: Integer unit of time (1 step = 1 hour).
2. `type`: Categorical transaction type (TRANSFER, CASH_OUT, PAYMENT, etc.).
3. `amount`: Floating-point transaction currency amount.

### Preprocessing Pipeline
- **Categorical Encoder**: `OneHotEncoder` applied to the `type` column.
- **Numerical Scaling**: `StandardScaler` applied to `step` and `amount` columns.
- Preprocessing fits are enclosed inside the `ColumnTransformer` and serialized inside the model pipeline to prevent data leakage during inference.

---

## 5. Excluded Columns & Leakage Control
To prevent temporal data leakage and artificial simulator-specific biases:
- **`isFlaggedFraud`**: Excluded to avoid reproducing a simple rule-based simulator threshold (>200,000 unit transfer).
- **`oldbalanceOrg`, `newbalanceOrig`, `oldbalanceDest`, `newbalanceDest`**: **EXCLUDED**. The PaySim documentation states that fraudulent transactions are cancelled within the simulation, making balance differences deterministic signals of fraud. Excluding them ensures the model learns predictive behavioral patterns instead of simulation artifacts.
- **`nameOrig`, `nameDest`**: Excluded because they are high-cardinality alphanumeric identifiers that promote memorization and block generalization.

---

## 6. Evaluation Metrics (Holdout Test Set)
Evaluated on a time-aware holdout set (`step > 600`) representing 922,646 transactions:
- **Precision**: ~0.8354
- **Recall (Sensitivity)**: ~0.8520
- **F1-Score**: ~0.8436
- **ROC-AUC**: ~0.9421
- **PR-AUC (Average Precision)**: ~0.8122

---

## 7. Limitations & Reproducibility
- **Memory-Conscious Training**: The training set is split on time (`step <= 600`), and stratified downsampled on the majority class to 200,000 rows (preserving all fraud cases) to ensure resource friendliness on standard laptops.
- **Reproducibility Information**:
  - Python Version: 3.12.7
  - Random Seeds: `random_state=42`
  - Saved Model Path: `ai/models/fraud_detection_model.joblib`
  - Standalone Inference Module: `ai/fraud_detector.py`
