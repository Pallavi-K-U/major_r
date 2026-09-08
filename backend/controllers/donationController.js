import mongoose from 'mongoose';
import Transaction from '../models/transaction.js';
import Project from '../models/project.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';
import { assessTransaction } from '../services/aiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let contractConfig = null;
const loadContractConfig = () => {
  if (contractConfig) return contractConfig;
  try {
    contractConfig = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../contract_config.json'), 'utf8')
    );
    return contractConfig;
  } catch (e) {
    return null;
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const createDonation = async (req, res, next) => {
  try {
    const { projectId, amount, idempotencyKey, transactionHash } = req.body;

    // 1. Basic validation
    if (!projectId || amount === undefined || !idempotencyKey) {
      return res.status(400).json({
        success: false,
        error: { message: 'Project ID, amount, and idempotency key are required', status: 400 },
      });
    }

    // 2. Amount numeric validation
    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Donation amount must be a valid numeric value', status: 400 },
      });
    }

    // 3. Amount <= 0 validation
    if (parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'Donation amount must be greater than zero', status: 400 },
      });
    }

    // 4. Validate project existence
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: { message: 'Project not found', status: 404 },
      });
    }

    // 5. Validate project ACTIVE status
    if (project.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        error: { message: 'Donations are only allowed on ACTIVE projects', status: 400 },
      });
    }

    // 6. Idempotency Check (Sequential)
    const existingTx = await Transaction.findOne({ idempotencyKey });
    if (existingTx) {
      return res.status(200).json({
        success: true,
        message: 'Duplicate request handled successfully',
        transaction: existingTx,
      });
    }

    // Blockchain Verification (If transactionHash is provided)
    let blockNumber = null;
    let fromAddress = null;
    let toAddress = null;
    let gasUsed = null;

    if (transactionHash) {
      try {
        const providerUrl = process.env.PROVIDER_URL || 'http://localhost:8545';
        const provider = new ethers.JsonRpcProvider(providerUrl);
        const txReceipt = await provider.getTransactionReceipt(transactionHash);

        if (!txReceipt) {
          return res.status(400).json({
            success: false,
            error: { message: 'Blockchain transaction not found on-chain', status: 400 },
          });
        }

        // The blockchain transaction must be confirmed before marking donation successful
        if (txReceipt.status !== 1) {
          return res.status(400).json({
            success: false,
            error: { message: 'Blockchain transaction failed on-chain', status: 400 },
          });
        }

        // Verify destination matches the deployed NGOFundManager contract
        const config = loadContractConfig();
        if (config && txReceipt.to.toLowerCase() !== config.address.toLowerCase()) {
          return res.status(400).json({
            success: false,
            error: { message: 'Blockchain transaction was not sent to the NGOFundManager contract', status: 400 },
          });
        }

        blockNumber = txReceipt.blockNumber;
        fromAddress = txReceipt.from;
        toAddress = txReceipt.to;
        gasUsed = txReceipt.gasUsed.toString();
      } catch (err) {
        return res.status(400).json({
          success: false,
          error: { message: 'Failed to verify transaction on-chain: ' + err.message, status: 400 },
        });
      }
    }

    // 7. Transaction execution with self-healing fallback and concurrent collision handling
    let transactionSuccess = false;
    let transactionDoc = null;
    let updatedProject = null;

    try {
      const session = await mongoose.startSession();
      await session.withTransaction(async () => {
        const transaction = new Transaction({
          donorId: req.user._id,
          projectId,
          amount: parsedAmount,
          idempotencyKey,
          status: 'SUCCESS',
          transactionHash,
          blockNumber,
          fromAddress,
          toAddress,
          gasUsed,
        });
        await transaction.save({ session });

        const proj = await Project.findOneAndUpdate(
          { _id: projectId, status: 'ACTIVE' },
          { $inc: { raisedAmount: parsedAmount } },
          { session, new: true }
        );

        if (!proj) {
          throw new Error('Project not found or not active');
        }

        transactionDoc = transaction;
        updatedProject = proj;
      });
      session.endSession();
      transactionSuccess = true;
    } catch (txError) {
      const errMsg = txError.message || '';
      const isDuplicateKey = txError.code === 11000 || errMsg.includes('duplicate key') || errMsg.includes('E11000');

      if (isDuplicateKey) {
        // Concurrent request collision: wait briefly for winning write to complete, then return it
        await sleep(150);
        const concurrentTx = await Transaction.findOne({ idempotencyKey });
        if (concurrentTx) {
          return res.status(200).json({
            success: true,
            message: 'Duplicate request handled successfully',
            transaction: concurrentTx,
          });
        }
      }

      // If error is about replica sets/transactions not supported on standalone local MongoDB, fallback to sequential
      if (
        errMsg.includes('Transaction numbers') ||
        errMsg.includes('ReplicaSet') ||
        errMsg.includes('replica set') ||
        txError.code === 251
      ) {
        try {
          const transaction = new Transaction({
            donorId: req.user._id,
            projectId,
            amount: parsedAmount,
            idempotencyKey,
            status: 'SUCCESS',
            transactionHash,
            blockNumber,
            fromAddress,
            toAddress,
            gasUsed,
          });
          await transaction.save();

          const proj = await Project.findOneAndUpdate(
            { _id: projectId, status: 'ACTIVE' },
            { $inc: { raisedAmount: parsedAmount } },
            { new: true }
          );

          if (!proj) {
            // Rollback
            await Transaction.deleteOne({ idempotencyKey });
            return res.status(400).json({
              success: false,
              error: { message: 'Project not found or not active', status: 400 },
            });
          }

          transactionDoc = transaction;
          updatedProject = proj;
          transactionSuccess = true;
        } catch (seqError) {
          const seqErrMsg = seqError.message || '';
          const isSeqDuplicate = seqError.code === 11000 || seqErrMsg.includes('duplicate key') || seqErrMsg.includes('E11000');

          if (isSeqDuplicate) {
            await sleep(150);
            const concurrentTx = await Transaction.findOne({ idempotencyKey });
            if (concurrentTx) {
              return res.status(200).json({
                success: true,
                message: 'Duplicate request handled successfully',
                transaction: concurrentTx,
              });
            }
          }

          return res.status(400).json({
            success: false,
            error: { message: seqError.message || 'Donation failed to process', status: 400 },
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          error: { message: txError.message || 'Donation failed to process', status: 400 },
        });
      }
    }

    if (transactionSuccess && transactionDoc && updatedProject) {
      // Phase 8: AI Fraud Risk Assessment (non-blocking)
      try {
        const currentHour = new Date().getHours(); // 0-23
        const aiFeatures = {
          step: currentHour,
          type: 'TRANSFER',
          amount: parsedAmount,
        };
        const aiResult = await assessTransaction(aiFeatures);

        if (aiResult.error) {
          // AI service unavailable — record error, don't block donation
          await Transaction.findByIdAndUpdate(transactionDoc._id, {
            'aiAssessment.error': aiResult.error,
            'aiAssessment.assessedAt': new Date(),
          });
        } else {
          // AI assessment succeeded
          await Transaction.findByIdAndUpdate(transactionDoc._id, {
            'aiAssessment.riskLevel': aiResult.riskLevel,
            'aiAssessment.probability': aiResult.probability,
            'aiAssessment.assessedAt': new Date(),
            'aiAssessment.error': null,
          });
        }

        // Reload updated transaction for response
        transactionDoc = await Transaction.findById(transactionDoc._id);
      } catch (aiErr) {
        // AI assessment completely failed — log and continue
        console.error('AI assessment error (non-blocking):', aiErr.message);
        try {
          await Transaction.findByIdAndUpdate(transactionDoc._id, {
            'aiAssessment.error': 'AI assessment failed: ' + aiErr.message,
            'aiAssessment.assessedAt': new Date(),
          });
        } catch (updateErr) {
          console.error('Failed to record AI error:', updateErr.message);
        }
      }

      return res.status(201).json({
        success: true,
        message: 'Donation successful',
        transaction: transactionDoc,
        project: updatedProject,
      });
    } else {
      return res.status(400).json({
        success: false,
        error: { message: 'Donation failed to process', status: 400 },
      });
    }
  } catch (error) {
    next(error);
  }
};

export const getOwnDonations = async (req, res, next) => {
  try {
    const donations = await Transaction.find({ donorId: req.user._id })
      .populate('projectId', 'title status')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      donations,
    });
  } catch (error) {
    next(error);
  }
};

export const getNgoDonations = async (req, res, next) => {
  try {
    const ownProjects = await Project.find({ ngoId: req.user._id }).select('_id');
    const projectIds = ownProjects.map((p) => p._id);

    const donations = await Transaction.find({ projectId: { $in: projectIds } })
      .populate('projectId', 'title')
      .populate('donorId', 'name email')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      donations,
    });
  } catch (error) {
    next(error);
  }
};

export const getNgoDonationsTotal = async (req, res, next) => {
  try {
    const ownProjects = await Project.find({ ngoId: req.user._id }).select('_id');
    const projectIds = ownProjects.map((p) => p._id);

    const result = await Transaction.aggregate([
      { $match: { projectId: { $in: projectIds }, status: 'SUCCESS' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const total = result.length > 0 ? result[0].total : 0;

    return res.status(200).json({
      success: true,
      total,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllTransactions = async (req, res, next) => {
  try {
    const transactions = await Transaction.find({})
      .populate('projectId', 'title')
      .populate('donorId', 'name email')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      transactions,
    });
  } catch (error) {
    next(error);
  }
};
