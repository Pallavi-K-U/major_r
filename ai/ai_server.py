"""
Phase 8: AI Fraud Detection HTTP Service

A lightweight Flask HTTP server wrapping the trained FraudDetector model.
Exposes:
  POST /predict  — accepts {step, type, amount}, returns {prediction, probability, risk_level}
  GET  /health   — returns {status: "UP"}

Runs on port 5001. Loads the joblib model once at startup.
"""

import os
import sys
from flask import Flask, request, jsonify

# Add parent directory to path so we can import fraud_detector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fraud_detector import FraudDetector

app = Flask(__name__)

# Load model once at startup
detector = None

def get_detector():
    global detector
    if detector is None:
        detector = FraudDetector()
    return detector

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "UP"}), 200

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json(force=True, silent=True)
        if data is None:
            return jsonify({
                "success": False,
                "error": "Request body must be valid JSON"
            }), 400

        # Validate required fields
        required_fields = ['step', 'type', 'amount']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    "success": False,
                    "error": f"Missing required feature: '{field}'"
                }), 400

        # Call the FraudDetector
        det = get_detector()
        result = det.predict({
            "step": data["step"],
            "type": data["type"],
            "amount": data["amount"]
        })

        return jsonify({
            "success": True,
            "prediction": result["prediction"],
            "probability": result["probability"],
            "risk_level": result["risk_level"]
        }), 200

    except ValueError as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 400
    except TypeError as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 400
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Internal server error: {str(e)}"
        }), 500

# --- Impact Analysis Endpoint ---
from impact_analyser import ImpactAnalyser

analyser = None

def get_analyser():
    global analyser
    if analyser is None:
        analyser = ImpactAnalyser()
    return analyser

@app.route('/analyse-impact', methods=['POST'])
def analyse_impact():
    try:
        data = request.get_json(force=True, silent=True)
        if data is None:
            return jsonify({
                "success": False,
                "error": "Request body must be valid JSON"
            }), 400

        if 'text' not in data:
            return jsonify({
                "success": False,
                "error": "Missing required field: 'text'"
            }), 400

        text = data['text']
        ia = get_analyser()
        result = ia.analyse(text)

        return jsonify({
            "success": True,
            "impact_score": result["impact_score"],
            "impact_level": result["impact_level"],
            "generated_summary": result["generated_summary"],
            "completeness_score": result["completeness_indicators"]["completeness_score"],
            "confidence_score": result["confidence_information"]["confidence_score"],
            "limitations": result["confidence_information"]["limitations"],
            "disclaimer": result["confidence_information"]["disclaimer"],
            "extracted_indicators": result["extracted_indicators"],
        }), 200

    except ValueError as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 400
    except TypeError as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 400
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Internal server error: {str(e)}"
        }), 500

if __name__ == '__main__':
    # Pre-load models at startup
    print("Loading fraud detection model...")
    get_detector()
    print("Loading impact analyser...")
    get_analyser()
    print("Models loaded successfully. Starting AI server on port 5001...")
    app.run(host='0.0.0.0', port=5001, debug=False)
