# Phase 7 AI Model Evaluation Report

- **Selected Model**: Random Forest
- **Optimal Threshold**: 0.89

## Holdout Test Set Performance

- **Precision**: 0.7909
- **Recall (Sensitivity)**: 0.1963
- **F1-Score**: 0.3145
- **ROC-AUC**: 0.8937
- **PR-AUC (Average Precision)**: 0.3103

### Confusion Matrix
- **True Negatives (TN)**: 101,890
- **False Positives (FP)**: 83
- **False Negatives (FN)**: 1,286
- **True Positives (TP)**: 314

## Precision/Recall Trade-off Analysis
In financial fraud detection:
- **False Negatives** (undetected fraud) represent direct financial loss.
- **False Positives** (flagging legitimate transactions) increase manual inspection costs and cause customer friction.
- The tuned threshold balances these values to maximize F1-score.
