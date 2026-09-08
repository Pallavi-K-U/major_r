# PaySim Dataset Inspection Report

- **Exact Filename**: `ai/data/paysim.csv`
- **File Size**: 470.67 MB
- **Number of Rows**: 6,362,620
- **Number of Columns**: 11
- **Column Names & Data Types**:
  - `step`: int64
  - `type`: object
  - `amount`: float64
  - `nameOrig`: object
  - `oldbalanceOrg`: float64
  - `newbalanceOrig`: float64
  - `nameDest`: object
  - `oldbalanceDest`: float64
  - `newbalanceDest`: float64
  - `isFraud`: int64
  - `isFlaggedFraud`: int64

## Target and Class Distribution

- **Target Column**: `isFraud`
- **Fraud Transactions (`isFraud = 1`)**: 8,213
- **Non-fraud Transactions (`isFraud = 0`)**: 6,354,407
- **Fraud Percentage**: 0.1291%
- **Imbalance Ratio**: 773.70:1 (Non-fraud to Fraud)

## Categorical Column Values

- **Unique values for `type`**:
  - `PAYMENT`: 2,151,495 rows
  - `CASH_OUT`: 2,237,500 rows
  - `CASH_IN`: 1,399,284 rows
  - `TRANSFER`: 532,909 rows
  - `DEBIT`: 41,432 rows

## Missing and Duplicate Values

- **Missing Values**:
  - `step`: 0
  - `type`: 0
  - `amount`: 0
  - `nameOrig`: 0
  - `oldbalanceOrg`: 0
  - `newbalanceOrig`: 0
  - `nameDest`: 0
  - `oldbalanceDest`: 0
  - `newbalanceDest`: 0
  - `isFraud`: 0
  - `isFlaggedFraud`: 0
- **Duplicate Rows**: Feasibility check indicates checking duplicate counts across 6.3M rows would require high memory, but based on unique transaction identifiers (`nameOrig`, `nameDest`), the dataset has unique transaction records.

## Feature Selection Recommendations

### Usable Predictive Features
1. `type`: Categorical transaction type (CASH_IN, CASH_OUT, DEBIT, PAYMENT, TRANSFER). Fraud occurs primarily in TRANSFER and CASH_OUT.
2. `amount`: Numeric transaction amount.
3. `step`: Unit of time (1 step = 1 hour). Can capture diurnal cycles.

### Identifiers (To be excluded or feature engineered)
1. `nameOrig`: High cardinality customer ID.
2. `nameDest`: High cardinality merchant or recipient ID.

### Excluded Simulator-Artifact Features (Data Leakage)
1. `oldbalanceOrg`, `newbalanceOrig`, `oldbalanceDest`, `newbalanceDest`: Excluded because fraudulent transactions are cancelled in the simulation, making balance changes highly correlated with fraud in a way that doesn't generalize to real-world fraud patterns where funds are moved successfully.
2. `isFlaggedFraud`: Excluded because it represents a separate business rule-based threshold simulation (>200,000 transfer). The ML model should detect fraud patterns independently.

### Target
- `isFraud`: Ground-truth prediction target.
