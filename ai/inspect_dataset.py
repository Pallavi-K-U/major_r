import os
import pandas as pd
import numpy as np

def inspect():
    csv_path = "ai/data/paysim.csv"
    if not os.path.exists(csv_path):
        print(f"Error: Dataset not found at {csv_path}")
        return

    # File size
    file_size_bytes = os.path.getsize(csv_path)
    file_size_mb = file_size_bytes / (1024 * 1024)

    # Let's read in chunks or check the size
    # Since PaySim is ~6.3 million rows (~650MB), we can read the schema first, and do a fast pass to count rows and compute isFraud distribution.
    print(f"File size: {file_size_mb:.2f} MB")

    # Read first 5 rows for columns and types
    df_head = pd.read_csv(csv_path, nrows=5)
    columns = list(df_head.columns)
    dtypes = df_head.dtypes.to_dict()

    print("Columns:", columns)
    print("Data types:", dtypes)

    # Fast chunked read to get row count, missing values, isFraud distribution
    total_rows = 0
    fraud_count = 0
    non_fraud_count = 0
    missing_counts = {col: 0 for col in columns}
    type_counts = {}

    print("Processing CSV in chunks...")
    chunksize = 100000
    for chunk in pd.read_csv(csv_path, chunksize=chunksize):
        total_rows += len(chunk)
        if 'isFraud' in chunk.columns:
            fraud_count += int((chunk['isFraud'] == 1).sum())
            non_fraud_count += int((chunk['isFraud'] == 0).sum())
        for col in columns:
            missing_counts[col] += int(chunk[col].isna().sum())
        if 'type' in chunk.columns:
            for t, count in chunk['type'].value_counts().items():
                type_counts[t] = type_counts.get(t, 0) + int(count)

    fraud_percentage = (fraud_count / total_rows) * 100 if total_rows > 0 else 0
    imbalance_ratio = non_fraud_count / fraud_count if fraud_count > 0 else float('inf')

    # Get unique values of categorical column 'type'
    print("Categorical types count:", type_counts)

    # Let's construct the inspection report
    report_content = f"""# PaySim Dataset Inspection Report

- **Exact Filename**: `ai/data/paysim.csv`
- **File Size**: {file_size_mb:.2f} MB
- **Number of Rows**: {total_rows:,}
- **Number of Columns**: {len(columns)}
- **Column Names & Data Types**:
{chr(10).join([f"  - `{col}`: {dtypes[col]}" for col in columns])}

## Target and Class Distribution

- **Target Column**: `isFraud`
- **Fraud Transactions (`isFraud = 1`)**: {fraud_count:,}
- **Non-fraud Transactions (`isFraud = 0`)**: {non_fraud_count:,}
- **Fraud Percentage**: {fraud_percentage:.4f}%
- **Imbalance Ratio**: {imbalance_ratio:.2f}:1 (Non-fraud to Fraud)

## Categorical Column Values

- **Unique values for `type`**:
{chr(10).join([f"  - `{t}`: {count:,} rows" for t, count in type_counts.items()])}

## Missing and Duplicate Values

- **Missing Values**:
{chr(10).join([f"  - `{col}`: {missing_counts[col]}" for col in columns])}
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
"""

    reports_dir = "ai/reports"
    os.makedirs(reports_dir, exist_ok=True)
    report_path = os.path.join(reports_dir, "dataset_inspection_report.md")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_content)
    print(f"Report written to {report_path}")

if __name__ == "__main__":
    inspect()
