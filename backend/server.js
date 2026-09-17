import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB, isDBConnected } from './config/db.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { register, login } from './controllers/authController.js';
import { updateUserProfile } from './controllers/userController.js';
import { authenticateUser, authorizeRoles } from './middleware/auth.js';
import { getNgoProfile, updateNgoProfile } from './controllers/ngoController.js';
import { createProject, updateProject, getOwnProjects, getActiveProjects, getProjectDetails } from './controllers/projectController.js';
import { getAllNgos, getAllProjects, verifyNgo, updateTransactionReview } from './controllers/adminController.js';
import { createDonation, getOwnDonations, getNgoDonations, getNgoDonationsTotal, getAllTransactions } from './controllers/donationController.js';
import { uploadDocument, getProjectDocuments, downloadDocument, deleteDocument } from './controllers/documentController.js';
import { analyseImpact } from './services/aiService.js';
import multer from 'multer';
import e2eFlowRouter from './routes/phase10/e2eFlow.js';
import chatRouter from './routes/chatRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
const corsOptions = {
  origin: frontendUrl,
  credentials: true,
};
app.use(cors(corsOptions));

// JSON Parser Middleware
app.use(express.json());

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  const dbStatus = isDBConnected() ? 'UP' : 'DOWN';
  const isHealthy = dbStatus === 'UP';

  const healthStatus = {
    status: isHealthy ? 'UP' : 'DOWN',
    timestamp: new Date().toISOString(),
    services: {
      backend: 'UP',
      database: dbStatus
    }
  };

  if (isHealthy) {
    return res.status(200).json(healthStatus);
  } else {
    return res.status(503).json(healthStatus);
  }
});

// Public Authentication Routes
app.post('/api/auth/register', register);
app.post('/api/auth/login', login);

// Protected User Routes
app.put('/api/users/:id', authenticateUser, updateUserProfile);

// Protected Mock Dashboard Routes
app.get('/api/donor/dashboard', authenticateUser, authorizeRoles('DONOR'), (req, res) => {
  res.status(200).json({ success: true, message: 'Welcome to the Donor Dashboard' });
});

app.get('/api/ngo/dashboard', authenticateUser, authorizeRoles('NGO'), (req, res) => {
  res.status(200).json({ success: true, message: 'Welcome to the NGO Dashboard' });
});

app.get('/api/admin/dashboard', authenticateUser, authorizeRoles('ADMIN'), (req, res) => {
  res.status(200).json({ success: true, message: 'Welcome to the Admin Dashboard' });
});

// NGO Profile Routes
app.get('/api/ngo/profile', authenticateUser, authorizeRoles('NGO'), getNgoProfile);
app.put('/api/ngo/profile', authenticateUser, authorizeRoles('NGO'), updateNgoProfile);

// Project Routes
app.post('/api/projects', authenticateUser, authorizeRoles('NGO'), createProject);
app.put('/api/projects/:id', authenticateUser, authorizeRoles('NGO'), updateProject);
app.get('/api/projects/my', authenticateUser, authorizeRoles('NGO'), getOwnProjects);
app.get('/api/projects/active', getActiveProjects);
app.get('/api/projects/:id', getProjectDetails);

// Admin Management Routes
app.get('/api/admin/ngos', authenticateUser, authorizeRoles('ADMIN'), getAllNgos);
app.get('/api/admin/projects', authenticateUser, authorizeRoles('ADMIN'), getAllProjects);
app.put('/api/admin/ngos/:id/verify', authenticateUser, authorizeRoles('ADMIN'), verifyNgo);
app.get('/api/admin/transactions', authenticateUser, authorizeRoles('ADMIN'), getAllTransactions);
app.put('/api/admin/transactions/:id/review', authenticateUser, authorizeRoles('ADMIN'), updateTransactionReview);

const upload = multer({ storage: multer.memoryStorage() });

// Donation Routes
app.post('/api/donations', authenticateUser, authorizeRoles('DONOR'), createDonation);
app.get('/api/donations/my', authenticateUser, authorizeRoles('DONOR'), getOwnDonations);
app.get('/api/ngo/donations', authenticateUser, authorizeRoles('NGO'), getNgoDonations);
app.get('/api/ngo/donations/total', authenticateUser, authorizeRoles('NGO'), getNgoDonationsTotal);

// Phase 10 End‑to‑End route registration
app.use('/api/e2e', e2eFlowRouter);

// AI Copilot Chatbot Route
app.use('/api/chat', chatRouter);
// Document / IPFS Storage Routes
app.post('/api/documents', authenticateUser, authorizeRoles('NGO'), upload.single('file'), uploadDocument);
app.get('/api/projects/:projectId/documents', getProjectDocuments);
app.get('/api/documents/:cid/download', downloadDocument);
app.delete('/api/documents/:id', authenticateUser, deleteDocument);

// Impact Analysis Route (Phase 9/10 integration)
app.post('/api/projects/:id/analyse-impact', authenticateUser, authorizeRoles('NGO'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!text || typeof text !== 'string' || text.trim() === '') {
      return res.status(400).json({
        success: false,
        error: { message: 'Report text is required for impact analysis', status: 400 },
      });
    }

    const Project = (await import('./models/project.js')).default;
    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: { message: 'Project not found', status: 404 },
      });
    }

    // Verify the NGO owns this project
    if (project.ngoId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied: you can only analyse your own projects', status: 403 },
      });
    }

    const aiResult = await analyseImpact(text);

    if (aiResult.error) {
      // AI service unavailable — record error, still return it
      project.impactAnalysis = {
        error: aiResult.error,
        analysedAt: new Date(),
      };
      await project.save();

      return res.status(200).json({
        success: true,
        message: 'Impact analysis attempted but AI service returned an error',
        impactAnalysis: project.impactAnalysis,
      });
    }

    // Store successful analysis
    project.impactAnalysis = {
      impactScore: aiResult.impactScore,
      impactLevel: aiResult.impactLevel,
      generatedSummary: aiResult.generatedSummary,
      completenessScore: aiResult.completenessScore,
      confidenceScore: aiResult.confidenceScore,
      limitations: aiResult.limitations,
      disclaimer: aiResult.disclaimer,
      analysedAt: new Date(),
      error: null,
    };
    await project.save();

    return res.status(200).json({
      success: true,
      message: 'Impact analysis completed successfully',
      impactAnalysis: project.impactAnalysis,
    });
  } catch (error) {
    next(error);
  }
});

// Milestone Release Route (Admin Escrow Tranche Release)
app.put('/api/projects/:id/milestones/:milestoneIndex/release', authenticateUser, authorizeRoles('ADMIN'), async (req, res, next) => {
  try {
    const { id, milestoneIndex } = req.params;
    const idx = parseInt(milestoneIndex, 10);

    const Project = (await import('./models/project.js')).default;
    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({ success: false, error: { message: 'Project not found', status: 404 } });
    }

    if (isNaN(idx) || idx < 0 || idx >= project.milestones.length) {
      return res.status(400).json({ success: false, error: { message: 'Invalid milestone index', status: 400 } });
    }

    project.milestones[idx].status = 'RELEASED';

    // If all milestones are released, mark project as COMPLETED
    const allReleased = project.milestones.every((m) => m.status === 'RELEASED');
    if (allReleased && project.milestones.length > 0) {
      project.status = 'COMPLETED';
    }

    await project.save();

    return res.status(200).json({
      success: true,
      message: `Milestone ${idx + 1} marked as RELEASED${allReleased ? ' (Project is now COMPLETED)' : ''}`,
      project,
    });
  } catch (error) {
    next(error);
  }
});

// 404 Handler
app.use(notFoundHandler);

// Centralized Error Handler
app.use(errorHandler);

// DB connection and Startup
const startServer = async () => {
  // Try connecting, but do not prevent server from starting so we can report DOWN database status on healthcheck
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Backend server is running on port ${PORT}`);
    console.log(`CORS allowed origin: ${frontendUrl}`);
  });
};

startServer();
