// backend/routes/phase10/e2eFlow.js
// Phase 10 integration status endpoint.
// Reports the availability of backend services for E2E testing.

import express from 'express';
import { authenticateUser, authorizeRoles } from '../../middleware/auth.js';
import { isDBConnected } from '../../config/db.js';
import { checkAiHealth } from '../../services/aiService.js';

const router = express.Router();

/**
 * GET /api/e2e/status
 * ---------------------------------------------------
 * Reports integration status of all backend services.
 * Protected – only ADMIN users may invoke it.
 */
router.get('/status', authenticateUser, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const aiHealthy = await checkAiHealth();

    return res.status(200).json({
      success: true,
      integration: {
        database: isDBConnected() ? 'UP' : 'DOWN',
        aiService: aiHealthy ? 'UP' : 'DOWN',
        ipfs: 'UP', // local mock gateway is always available
        backend: 'UP',
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
