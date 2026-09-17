import Project from '../models/project.js';
import Transaction from '../models/transaction.js';
import User from '../models/user.js';
import NgoProfile from '../models/ngoProfile.js';

/**
 * Intelligent Local Context Search & Response Generator
 */
async function generateLocalResponse(userMessage) {
  const query = (userMessage || '').toLowerCase().trim();

  // 1. Fetch live platform context
  const activeProjects = await Project.find({ status: 'ACTIVE' }).lean();
  const totalTransactions = await Transaction.countDocuments();
  const recentTransactions = await Transaction.find().sort({ createdAt: -1 }).limit(5).populate('projectId', 'title').lean();

  // --- A. Project / Campaign Questions ---
  if (
    query.includes('campaign') ||
    query.includes('project') ||
    query.includes('water') ||
    query.includes('forest') ||
    query.includes('donate to') ||
    query.includes('active')
  ) {
    // Check if user is asking about a specific project
    const matchedProject = activeProjects.find(p => query.includes(p.title.toLowerCase()) || (p.description && query.includes(p.description.toLowerCase().slice(0, 10))));

    if (matchedProject) {
      const msList = (matchedProject.milestones || [])
        .map(m => `  • **${m.title}**: ${m.amount} ETH (${m.status || 'PENDING'})`)
        .join('\n');

      const impact = matchedProject.impactAnalysis?.impactLevel
        ? `\n📊 **AI Impact Assessment**: **${matchedProject.impactAnalysis.impactLevel}** (Score: ${matchedProject.impactAnalysis.impactScore || 'N/A'}/10)`
        : '\n📊 **AI Impact Assessment**: Not yet evaluated by NGO';

      return {
        reply: `### 🎯 **${matchedProject.title}**\n\n` +
          `• **Description**: ${matchedProject.description}\n` +
          `• **Target**: **${matchedProject.targetAmount} ETH** | **Raised**: **${matchedProject.raisedAmount || 0} ETH**\n` +
          `• **On-Chain ID**: \`${matchedProject.blockchainId || 0}\`\n` +
          `• **Status**: ✅ Active\n` +
          `${impact}\n\n` +
          `**Milestones Breakdown:**\n${msList || '  • Milestone details pending.'}\n\n` +
          `👉 You can donate directly on the project details page!`,
        suggestedActions: ['💡 How to donate via MetaMask', '💧 Show all active campaigns', '📊 Explain AI Impact Score']
      };
    }

    // List all active projects
    const projCards = activeProjects.map(p => {
      const raised = p.raisedAmount || 0;
      const target = p.targetAmount || 1;
      const pct = Math.round((raised / target) * 100);
      const impactBadge = p.impactAnalysis?.impactLevel ? ` | 🌿 Impact: **${p.impactAnalysis.impactLevel}**` : '';
      return `• **${p.title}** — Target: **${target} ETH** (Raised: ${raised} ETH / ${pct}%)${impactBadge}`;
    }).join('\n');

    return {
      reply: `### 🌐 **Currently Active Campaigns (${activeProjects.length})**\n\n` +
        `${projCards || 'No active campaigns found at the moment.'}\n\n` +
        `Click on any project on the home page to view its milestone breakdown, audit documents, and submit on-chain donations.`,
      suggestedActions: ['💡 How to donate via MetaMask', '🛡️ Explain AI Fraud Risk', '📈 What is AI Impact Analysis?']
    };
  }

  // --- B. MetaMask & Web3 Connection Questions ---
  if (
    query.includes('metamask') ||
    query.includes('wallet') ||
    query.includes('connect') ||
    query.includes('test eth') ||
    query.includes('fake money') ||
    query.includes('network') ||
    query.includes('chain id') ||
    query.includes('31337')
  ) {
    return {
      reply: `### 🦊 **MetaMask & Hardhat Local Network Setup**\n\n` +
        `This platform runs on a local Hardhat test blockchain with **free test ETH** (no real money needed):\n\n` +
        `**1. Add Hardhat Local Network to MetaMask:**\n` +
        `• **Network Name:** \`Hardhat Local\`\n` +
        `• **RPC URL:** \`http://127.0.0.1:8545\`\n` +
        `• **Chain ID:** \`31337\`\n` +
        `• **Currency Symbol:** \`ETH\`\n\n` +
        `**2. Import Free 10,000 Test ETH Account:**\n` +
        `• Open MetaMask → Click Account Menu → **Import Account**\n` +
        `• Paste this Hardhat private key:\n` +
        `\`0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80\`\n\n` +
        `Your account will immediately show **10,000 free ETH**!`,
      suggestedActions: ['💡 How to donate via MetaMask', '💧 Show active campaigns', '🛡️ Explain AI Fraud Risk']
    };
  }

  // --- C. AI Fraud Detection & Risk Level Questions ---
  if (
    query.includes('fraud') ||
    query.includes('risk') ||
    query.includes('score') ||
    query.includes('high risk') ||
    query.includes('under review') ||
    query.includes('ai risk') ||
    query.includes('paysim')
  ) {
    return {
      reply: `### 🛡️ **How the AI Fraud Risk Engine Works**\n\n` +
        `Our fraud detection module (\`ai/fraud_detector.py\`) uses a **Random Forest ML model** trained on 6.3M financial transactions:\n\n` +
        `**Features Analyzed on Every Donation:**\n` +
        `1. **Hour / Time-step (\`step\`):** Evaluates if transfer occurs at odd late-night hours (e.g. midnight).\n` +
        `2. **Transaction Type (\`type\`):** Analyzes direct \`TRANSFER\` vs standard payment channels.\n` +
        `3. **Amount (\`amount\`):** Detects probing micro-transfers or extreme spikes.\n\n` +
        `**Risk Levels:**\n` +
        `• 🟢 **LOW (< 20%):** Standard legitimate donation.\n` +
        `• 🟡 **MEDIUM (20% – 40%):** Flagged for automated monitoring.\n` +
        `• 🔴 **HIGH (≥ 40%):** Anomaly detected (e.g. midnight transfers) $\\rightarrow$ placed **UNDER_REVIEW** in the Admin Dashboard for compliance sign-off without freezing on-chain funds!`,
      suggestedActions: ['📈 What is AI Impact Analysis?', '💧 Show active campaigns', '🔑 How to login as Admin']
    };
  }

  // --- D. AI Social Impact Analysis Questions ---
  if (
    query.includes('impact') ||
    query.includes('spacy') ||
    query.includes('nlp') ||
    query.includes('beneficiar') ||
    query.includes('milestone') ||
    query.includes('report')
  ) {
    return {
      reply: `### 📈 **How AI Social Impact Analysis Works**\n\n` +
        `Our impact engine (\`ai/impact_analyser.py\`) uses **spaCy Natural Language Processing** to convert unstructured NGO reports into an objective **Impact Score (0–10)**:\n\n` +
        `**5 Key Dimensions Extracted:**\n` +
        `1. 👥 **Beneficiary Counts:** Quantified numbers of people, families, or students aided.\n` +
        `2. 🎯 **Project Outcomes:** Action verbs (\`provide\`, \`build\`, \`improve\`, \`deliver\`).\n` +
        `3. 🏁 **Completion Indicators:** Milestone fulfillment markers.\n` +
        `4. 💰 **Budget Utilization:** Financial transparency keywords (\`budget\`, \`utilization\`, \`spent\`).\n` +
        `5. 📊 **Key Metrics (KPIs):** Percentages and physical units installed.\n\n` +
        `**Ethical AI Rule:** If numbers are missing, the system marks them as **Unavailable** rather than hallucinating fake data.`,
      suggestedActions: ['💧 Show active campaigns', '🛡️ Explain AI Fraud Risk', '💡 How to donate via MetaMask']
    };
  }

  // --- E. Roles & How to Donate / How to Use Platform ---
  if (
    query.includes('how to') ||
    query.includes('donate') ||
    query.includes('admin') ||
    query.includes('ngo') ||
    query.includes('register') ||
    query.includes('login')
  ) {
    return {
      reply: `### 🧭 **Platform User Guide & Roles**\n\n` +
        `• **DONOR:** Browse active campaigns, connect MetaMask, donate on-chain, and track transaction histories & impact metrics.\n` +
        `• **NGO:** Set up organization profiles, create milestone-based campaigns, upload proof documents to IPFS, and run AI impact analysis on project reports.\n` +
        `• **ADMIN:** Verify pending NGO accounts, inspect the global blockchain ledger, review AI fraud anomaly flags, and update review statuses (\`CLEARED\` / \`ESCALATED\`).\n\n` +
        `**Admin Credentials:**\n` +
        `• **Email:** \`admin@test.com\`\n` +
        `• **Password:** \`AdminPass123!\``,
      suggestedActions: ['💡 How to donate via MetaMask', '💧 Show active campaigns', '🛡️ Explain AI Fraud Risk']
    };
  }

  // --- F. Default Intelligent Overview ---
  return {
    reply: `👋 Hello! I am the **VeriFund AI Copilot**. I can help you with:\n\n` +
      `• 💧 **Active Campaigns:** Information on currently running NGO projects and funding goals.\n` +
      `• 🦊 **MetaMask & Web3:** Connecting to the local Hardhat blockchain with 10,000 free test ETH.\n` +
      `• 🛡️ **AI Fraud Detection:** How the ML model scores transaction risk.\n` +
      `• 📈 **AI Impact Analysis:** How spaCy evaluates NGO project reports and beneficiary metrics.\n` +
      `• 🔐 **Platform Roles:** How Donors, NGOs, and Admins interact with the system.\n\n` +
      `What would you like to know?`,
    suggestedActions: [
      '💧 Show active campaigns',
      '💡 How to donate via MetaMask',
      '🛡️ Explain AI Fraud Risk',
      '📈 What is AI Impact Analysis?'
    ]
  };
}

/**
 * Controller endpoint: POST /api/chat
 */
export const handleChatMessage = async (req, res, next) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({
        success: false,
        error: { message: 'Message content is required', status: 400 }
      });
    }

    // Check if Gemini API key is configured for enhanced LLM reasoning
    const geminiKey = process.env.GEMINI_API_KEY;

    if (geminiKey) {
      try {
        const activeProjects = await Project.find({ status: 'ACTIVE' }).lean();
        const recentTx = await Transaction.find().sort({ createdAt: -1 }).limit(5).lean();

        const contextData = {
          projects: activeProjects.map(p => ({
            title: p.title,
            targetAmount: p.targetAmount,
            raisedAmount: p.raisedAmount,
            status: p.status,
            blockchainId: p.blockchainId,
            milestones: (p.milestones || []).map(m => ({ title: m.title, amount: m.amount, status: m.status })),
            impactLevel: p.impactAnalysis?.impactLevel,
            impactScore: p.impactAnalysis?.impactScore,
          })),
          recentTransactionsCount: recentTx.length,
          network: 'Hardhat Local (Chain ID: 31337, RPC: http://127.0.0.1:8545)'
        };

        const prompt = `You are VeriFund AI Copilot, an expert AI assistant for the VeriFund Decentralized NGO Donation & Transparency Platform.
Live Platform Data:
${JSON.stringify(contextData, null, 2)}

User Question: "${message}"

Answer accurately, politely, and format your answer with markdown bullet points. Be concise.`;

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }]
            })
          }
        );

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const replyText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (replyText) {
            return res.status(200).json({
              success: true,
              reply: replyText,
              suggestedActions: [
                '💧 Show active campaigns',
                '💡 How to donate via MetaMask',
                '🛡️ Explain AI Fraud Risk',
                '📈 What is AI Impact Analysis?'
              ]
            });
          }
        }
      } catch (geminiErr) {
        console.warn('Gemini API call fallback to local engine:', geminiErr.message);
      }
    }

    // Fallback: Local Context Intelligence Engine
    const localResult = await generateLocalResponse(message);
    return res.status(200).json({
      success: true,
      reply: localResult.reply,
      suggestedActions: localResult.suggestedActions || []
    });
  } catch (error) {
    next(error);
  }
};
