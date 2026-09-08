/**
 * AI Service — calls the Python fraud detection HTTP server.
 *
 * assessTransaction(features) → { riskLevel, probability } | { error }
 *
 * Non-blocking: if the AI server is down the caller receives an error
 * object instead of a thrown exception, so the donation flow is never blocked.
 */

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';
const AI_TIMEOUT_MS = 5000; // 5-second timeout

export const assessTransaction = async (features) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch(`${AI_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(features),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const data = await response.json();

    if (!response.ok || !data.success) {
      return { error: data.error || `AI service returned HTTP ${response.status}` };
    }

    return {
      riskLevel: data.risk_level,
      probability: data.probability,
    };
  } catch (err) {
    clearTimeout(timeout);

    if (err.name === 'AbortError') {
      return { error: 'AI service request timed out' };
    }

    return { error: `AI service unavailable: ${err.message}` };
  }
};

export const checkAiHealth = async () => {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    const data = await response.json();
    return data.status === 'UP';
  } catch {
    return false;
  }
};

/**
 * Impact Analysis — calls the Python impact analysis HTTP endpoint.
 *
 * analyseImpact(text) → { impactScore, impactLevel, ... } | { error }
 *
 * Non-blocking: if the AI server is down the caller receives an error
 * object instead of a thrown exception.
 */
export const analyseImpact = async (text) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s for longer analysis

  try {
    const response = await fetch(`${AI_SERVICE_URL}/analyse-impact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const data = await response.json();

    if (!response.ok || !data.success) {
      return { error: data.error || `AI service returned HTTP ${response.status}` };
    }

    return {
      impactScore: data.impact_score,
      impactLevel: data.impact_level,
      generatedSummary: data.generated_summary,
      completenessScore: data.completeness_score,
      confidenceScore: data.confidence_score,
      limitations: data.limitations || [],
      disclaimer: data.disclaimer,
    };
  } catch (err) {
    clearTimeout(timeout);

    if (err.name === 'AbortError') {
      return { error: 'Impact analysis request timed out' };
    }

    return { error: `AI service unavailable: ${err.message}` };
  }
};
