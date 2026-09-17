import express from 'express';
import { handleChatMessage } from '../controllers/chatController.js';

const router = express.Router();

router.post('/', handleChatMessage);

export default router;
