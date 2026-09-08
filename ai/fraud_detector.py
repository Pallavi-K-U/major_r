import os
import joblib
import pandas as pd
import numpy as np

class FraudDetector:
    """
    FraudDetector loads a trained scikit-learn pipeline and predicts transaction fraud risks.
    
    Risk Level Threshold Rules:
    - HIGH Risk: Probability score >= Classification Threshold (Tuned value).
    - MEDIUM Risk: Classification Threshold * 0.5 <= Probability score < Classification Threshold.
    - LOW Risk: Probability score < Classification Threshold * 0.5.
    
    Disclaimer:
    The output probability is a model score based on the PaySim synthetic distribution
    and is not calibrated to represent real-world statistical probability.
    """
    def __init__(self, model_path=None):
        if model_path is None:
            # Default lookup path
            base_dir = os.path.dirname(os.path.abspath(__file__))
            model_path = os.path.join(base_dir, "models", "fraud_detection_model.joblib")

        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Trained model file not found at: {model_path}")

        # Load persisted model dictionary (TC-18: no training CSV required)
        self.model_data = joblib.load(model_path)
        self.pipeline = self.model_data['pipeline']
        self.features = self.model_data['features']
        self.threshold = self.model_data['threshold']

    def predict(self, input_data):
        """
        Predict fraud risk for given transaction data.
        input_data: Can be a dict, a list of dicts, or a pandas DataFrame.
        """
        # Convert input formats
        if isinstance(input_data, dict):
            df = pd.DataFrame([input_data])
            is_single = True
        elif isinstance(input_data, list):
            df = pd.DataFrame(input_data)
            is_single = False
        elif isinstance(input_data, pd.DataFrame):
            df = input_data.copy()
            is_single = False
        else:
            raise TypeError("Input must be a dictionary, list of dictionaries, or a pandas DataFrame.")

        # TC-16: Check for missing required features
        for feature in self.features:
            if feature not in df.columns:
                raise ValueError(f"Validation Error: Missing required feature column '{feature}'")
            
            # Check for null / missing value counts in inputs
            if df[feature].isna().any():
                raise ValueError(f"Validation Error: Column '{feature}' contains missing or NaN values")

        # TC-17: Check for invalid data types
        # 'step' must be numeric integer/float convertible
        try:
            df['step'] = pd.to_numeric(df['step'], errors='raise')
        except Exception:
            raise TypeError("Validation Error: Feature 'step' must be a numeric value")

        # 'amount' must be numeric float/int convertible
        try:
            df['amount'] = pd.to_numeric(df['amount'], errors='raise')
        except Exception:
            raise TypeError("Validation Error: Feature 'amount' must be a numeric value")

        # Validate that amount is non-negative
        if (df['amount'] < 0).any():
            raise ValueError("Validation Error: Transaction 'amount' cannot be negative")

        # Keep only features expected by the model pipeline
        df_model = df[self.features]

        # Execute predictions without retraining (TC-24)
        probabilities = self.pipeline.predict_proba(df_model)[:, 1]

        results = []
        for prob in probabilities:
            prob_float = float(prob)
            prediction = 1 if prob_float >= self.threshold else 0

            # Set risk levels based on probability relative to tuned threshold
            if prob_float >= self.threshold:
                risk_level = "HIGH"
            elif prob_float >= (self.threshold * 0.5):
                risk_level = "MEDIUM"
            else:
                risk_level = "LOW"

            results.append({
                "prediction": prediction,
                "probability": prob_float,
                "risk_level": risk_level
            })

        return results[0] if is_single else results
