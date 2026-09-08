# Dataset Information

The PaySim synthetic mobile money fraud dataset (`paysim.csv`, ~470 MB) exceeds GitHub's 100 MB file limit and is excluded from source control.

The trained model is committed at `ai/models/fraud_detection_model.joblib` and is ready for inference.

If you wish to retrain the model:
1. Download the PaySim dataset from Kaggle: [PaySim Synthetic Dataset for Mobile Money Payments](https://www.kaggle.com/datasets/ealaxi/paysim1)
2. Place `paysim.csv` inside this `ai/data/` directory.
3. Run `python ai/train.py`.
