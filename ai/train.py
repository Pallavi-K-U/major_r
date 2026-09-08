import os
import sys
import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    precision_score, recall_score, f1_score,
    confusion_matrix, roc_auc_score, average_precision_score
)

def run_training():
    print("=== Phase 7 AI Training Pipeline ===")
    csv_path = "ai/data/paysim.csv"

    # TC-2: Dataset file is missing
    if not os.path.exists(csv_path):
        print(f"Error: Dataset file not found at {csv_path}", file=sys.stderr)
        sys.exit(1)

    # TC-1: Load dataset schema and columns
    print("Loading dataset (memory-conscious column filter)...")
    try:
        # Load only columns we need for training
        # Target leakage prevention: do NOT load isFlaggedFraud, balances, or names for features
        # Keep original CSV unchanged (TC-22)
        df = pd.read_csv(csv_path, usecols=['step', 'type', 'amount', 'isFraud'])
    except Exception as e:
        # TC-3: Dataset is corrupted/unreadable
        print(f"Error: Failed to read dataset. File might be corrupted: {e}", file=sys.stderr)
        sys.exit(1)

    # TC-4: Target column is missing
    if 'isFraud' not in df.columns:
        print("Error: Target column 'isFraud' is missing from dataset.", file=sys.stderr)
        sys.exit(1)

    # TC-5: Target contains unexpected values
    unique_targets = df['isFraud'].unique()
    if not set(unique_targets).issubset({0, 1}):
        print(f"Error: Target column contains unexpected values: {unique_targets}", file=sys.stderr)
        sys.exit(1)

    # TC-6: Class distribution calculation
    total_tx = len(df)
    fraud_tx = int((df['isFraud'] == 1).sum())
    non_fraud_tx = int((df['isFraud'] == 0).sum())
    fraud_pct = (fraud_tx / total_tx) * 100
    print(f"Dataset stats: Total={total_tx:,}, Fraud={fraud_tx:,} ({fraud_pct:.4f}%), Non-Fraud={non_fraud_tx:,}")

    # TC-7: Train/test split (Time-aware holdout)
    # step representing hours. We holdout steps > 600 for testing (temporal split)
    print("Performing time-aware train/test split...")
    train_df = df[df['step'] <= 600].copy()
    test_df = df[df['step'] > 600].copy()

    # Verify both classes exist in both sets
    train_fraud = (train_df['isFraud'] == 1).sum()
    test_fraud = (test_df['isFraud'] == 1).sum()
    if train_fraud == 0 or test_fraud == 0:
        print(f"Error: Invalid time-aware split. Train fraud count: {train_fraud}, Test fraud count: {test_fraud}", file=sys.stderr)
        sys.exit(1)

    print(f"Train rows: {len(train_df):,} (Fraud={train_fraud:,})")
    print(f"Test rows: {len(test_df):,} (Fraud={test_fraud:,})")

    # Split training set into fit and validation sets to tune threshold
    # Using 80/20 stratified split on train_df
    fit_df, val_df = train_test_split(
        train_df,
        test_size=0.20,
        random_state=42,
        stratify=train_df['isFraud']
    )

    # Memory-conscious downsampling of the fit set majority class (non-fraud)
    # Keep all fraud, sample 200,000 non-fraud
    fit_fraud = fit_df[fit_df['isFraud'] == 1]
    fit_non_fraud = fit_df[fit_df['isFraud'] == 0]

    # Sample non-fraud
    sampled_non_fraud = fit_non_fraud.sample(n=200000, random_state=42)
    fit_sampled = pd.concat([fit_fraud, sampled_non_fraud]).sample(frac=1.0, random_state=42)
    
    print(f"Downsampled Fit dataset size: {len(fit_sampled):,} (Fraud={len(fit_fraud):,}, Non-Fraud=200,000)")

    # Prepare features and target
    features = ['step', 'type', 'amount']
    X_train = fit_sampled[features]
    y_train = fit_sampled['isFraud']

    X_val = val_df[features]
    y_val = val_df['isFraud']

    X_test = test_df[features]
    y_test = test_df['isFraud']

    # TC-8: Preprocessing pipeline setup
    print("Setting up preprocessing pipeline...")
    # ColumnTransformer handles categoricals (type) and scaling (amount, step)
    preprocessor = ColumnTransformer(
        transformers=[
            ('cat', OneHotEncoder(handle_unknown='ignore'), ['type']),
            ('num', StandardScaler(), ['amount', 'step'])
        ]
    )

    # Pre-fit preprocessor to verify it succeeds (TC-8)
    preprocessor.fit(X_train)
    print("Preprocessing ColumnTransformer trained successfully.")

    # TC-9: Train Logistic Regression
    print("Training Logistic Regression...")
    lr_pipeline = Pipeline([
        ('preprocessor', preprocessor),
        ('classifier', LogisticRegression(class_weight='balanced', random_state=42, max_iter=1000))
    ])
    lr_pipeline.fit(X_train, y_train)
    print("Logistic Regression trained successfully.")

    # TC-10: Train Random Forest
    print("Training Random Forest...")
    rf_pipeline = Pipeline([
        ('preprocessor', preprocessor),
        ('classifier', RandomForestClassifier(n_estimators=100, class_weight='balanced', random_state=42, n_jobs=-1))
    ])
    rf_pipeline.fit(X_train, y_train)
    print("Random Forest trained successfully.")

    # Threshold tuning on Validation data
    # We find threshold that maximizes F1 score on validation set
    print("Tuning threshold on validation set...")
    lr_probs = lr_pipeline.predict_proba(X_val)[:, 1]
    rf_probs = rf_pipeline.predict_proba(X_val)[:, 1]

    best_lr_thresh = 0.5
    best_lr_f1 = 0.0
    best_rf_thresh = 0.5
    best_rf_f1 = 0.0

    thresholds = np.linspace(0.01, 0.99, 99)
    for thresh in thresholds:
        # Logistic Regression
        lr_pred = (lr_probs >= thresh).astype(int)
        lr_f1 = f1_score(y_val, lr_pred)
        if lr_f1 > best_lr_f1:
            best_lr_f1 = lr_f1
            best_lr_thresh = thresh

        # Random Forest
        rf_pred = (rf_probs >= thresh).astype(int)
        rf_f1 = f1_score(y_val, rf_pred)
        if rf_f1 > best_rf_f1:
            best_rf_f1 = rf_f1
            best_rf_thresh = thresh

    print(f"Validation results (Tuned Thresholds):")
    print(f"  Logistic Regression F1: {best_lr_f1:.4f} (Threshold: {best_lr_thresh:.2f})")
    print(f"  Random Forest F1: {best_rf_f1:.4f} (Threshold: {best_rf_thresh:.2f})")

    # Model Selection (TC-12)
    # Select best model based on F1-score on validation data
    if best_rf_f1 >= best_lr_f1:
        print("Selected Random Forest as the final model.")
        selected_pipeline = rf_pipeline
        selected_threshold = best_rf_thresh
        selected_name = "Random Forest"
    else:
        print("Selected Logistic Regression as the final model.")
        selected_pipeline = lr_pipeline
        selected_threshold = best_lr_thresh
        selected_name = "Logistic Regression"

    # Evaluate final selected model on Test Set
    print("Evaluating selected model on holdout test set...")
    test_probs = selected_pipeline.predict_proba(X_test)[:, 1]
    test_pred = (test_probs >= selected_threshold).astype(int)

    precision = precision_score(y_test, test_pred)
    recall = recall_score(y_test, test_pred)
    f1 = f1_score(y_test, test_pred)
    roc_auc = roc_auc_score(y_test, test_probs)
    pr_auc = average_precision_score(y_test, test_probs)
    cm = confusion_matrix(y_test, test_pred)

    tn, fp, fn, tp = cm.ravel()

    # TC-11: Evaluation metrics generation output
    metrics_report = f"""# Phase 7 AI Model Evaluation Report

- **Selected Model**: {selected_name}
- **Optimal Threshold**: {selected_threshold:.2f}

## Holdout Test Set Performance

- **Precision**: {precision:.4f}
- **Recall (Sensitivity)**: {recall:.4f}
- **F1-Score**: {f1:.4f}
- **ROC-AUC**: {roc_auc:.4f}
- **PR-AUC (Average Precision)**: {pr_auc:.4f}

### Confusion Matrix
- **True Negatives (TN)**: {tn:,}
- **False Positives (FP)**: {fp:,}
- **False Negatives (FN)**: {fn:,}
- **True Positives (TP)**: {tp:,}

## Precision/Recall Trade-off Analysis
In financial fraud detection:
- **False Negatives** (undetected fraud) represent direct financial loss.
- **False Positives** (flagging legitimate transactions) increase manual inspection costs and cause customer friction.
- The tuned threshold balances these values to maximize F1-score.
"""

    os.makedirs("ai/reports", exist_ok=True)
    with open("ai/reports/model_evaluation_report.md", "w", encoding="utf-8") as f:
        f.write(metrics_report)
    print("Evaluation report written to ai/reports/model_evaluation_report.md")

    # TC-13: Save the joblib model package
    model_dir = "ai/models"
    os.makedirs(model_dir, exist_ok=True)
    model_path = os.path.join(model_dir, "fraud_detection_model.joblib")
    
    model_data = {
        'pipeline': selected_pipeline,
        'features': features,
        'threshold': float(selected_threshold),
        'metrics': {
            'precision': float(precision),
            'recall': float(recall),
            'f1': float(f1),
            'roc_auc': float(roc_auc),
            'pr_auc': float(pr_auc)
        }
    }
    joblib.dump(model_data, model_path)
    print(f"Model saved successfully to {model_path}")

if __name__ == "__main__":
    run_training()
