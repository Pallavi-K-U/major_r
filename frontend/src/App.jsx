import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import {
  checkHealth,
  registerUser,
  loginUser,
  logoutUser,
  getNgoProfile,
  updateNgoProfile,
  createProject,
  getOwnProjects,
  getActiveProjects,
  getProjectDetails,
  adminGetNgos,
  adminGetProjects,
  adminVerifyNgo,
  donateToProject,
  getDonationHistory,
  getNgoDonations,
  getNgoDonationsTotal,
  adminGetTransactions,
  adminUpdateTransactionReview,
  uploadProjectDocument,
  getProjectDocuments,
  deleteProjectDocument,
  analyseProjectImpact,
} from './services/api';

function App() {
  const [view, setView] = useState('home'); // home, login, register, dashboard, project-details
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user_profile');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  // Wallet State
  const [walletAddress, setWalletAddress] = useState('');
  const [chainId, setChainId] = useState('');
  const [wrongNetwork, setWrongNetwork] = useState(false);
  const [web3Status, setWeb3Status] = useState('IDLE'); // IDLE, CONNECTING, SIGNING, PENDING, SUCCESS
  const [web3Error, setWeb3Error] = useState('');

  // Health Check
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthInfo, setHealthInfo] = useState(null);
  const [healthError, setHealthError] = useState(null);

  // Forms
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState('DONOR');
  const [regError, setRegError] = useState(null);
  const [regSuccess, setRegSuccess] = useState(null);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState(null);

  // NGO Dashboard states
  const [ngoProfile, setNgoProfile] = useState(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editNgoName, setEditNgoName] = useState('');
  const [editNgoDesc, setEditNgoDesc] = useState('');
  const [editNgoReg, setEditNgoReg] = useState('');
  const [editNgoWallet, setEditNgoWallet] = useState('');
  const [ngoProfileError, setNgoProfileError] = useState(null);

  const [ngoProjects, setNgoProjects] = useState([]);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [projTitle, setProjTitle] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [projTarget, setProjTarget] = useState(0);
  const [projStart, setProjStart] = useState('');
  const [projEnd, setProjEnd] = useState('');
  const [projStatus, setProjStatus] = useState('DRAFT');
  const [projMilestones, setProjMilestones] = useState([]);
  const [projError, setProjError] = useState(null);

  // Milestone input form
  const [msTitle, setMsTitle] = useState('');
  const [msDesc, setMsDesc] = useState('');
  const [msAmount, setMsAmount] = useState(0);

  // NGO Donation list
  const [ngoDonations, setNgoDonations] = useState([]);
  const [ngoTotalReceived, setNgoTotalReceived] = useState(0);

  // Donor view states
  const [activeProjects, setActiveProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projDetailError, setProjDetailError] = useState(null);
  
  // Donor Donation processing
  const [donationAmount, setDonationAmount] = useState(0);
  const [donationError, setDonationError] = useState(null);
  const [donationSuccess, setDonationSuccess] = useState(null);
  const [donationHistory, setDonationHistory] = useState([]);

  // Admin Dashboard states
  const [adminNgos, setAdminNgos] = useState([]);
  const [adminProjects, setAdminProjects] = useState([]);
  const [adminTransactions, setAdminTransactions] = useState([]);
  const [adminError, setAdminError] = useState(null);

  // IPFS Document locker states
  const [projectDocuments, setProjectDocuments] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);

  // Impact Analysis states
  const [impactText, setImpactText] = useState('');
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactError, setImpactError] = useState(null);
  const [impactResult, setImpactResult] = useState(null);

  const fetchHealthStatus = async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const result = await checkHealth();
      setHealthInfo(result.data);
      if (!result.ok) {
        setHealthError(`Backend reported unhealthy status (HTTP ${result.status})`);
      }
    } catch (err) {
      setHealthError('Failed to contact the backend service.');
    } finally {
      setHealthLoading(false);
    }
  };

  const connectWallet = async () => {
    setWeb3Error('');
    if (!window.ethereum) {
      setWeb3Error('MetaMask extension not detected. Please install MetaMask.');
      return;
    }
    try {
      setWeb3Status('CONNECTING');
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setWalletAddress(accounts[0]);
      
      const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
      setChainId(currentChainId);
      
      // Hardhat network is Chain ID 31337 (0x7a69)
      if (currentChainId !== '0x7a69' && currentChainId !== 31337 && currentChainId !== '31337') {
        setWrongNetwork(true);
        setWeb3Error('Network mismatch: please switch MetaMask to Hardhat Local Node (Chain ID: 31337).');
      } else {
        setWrongNetwork(false);
      }
      setWeb3Status('IDLE');
    } catch (err) {
      setWeb3Status('IDLE');
      setWeb3Error(err.message || 'User rejected wallet connection');
    }
  };

  useEffect(() => {
    fetchHealthStatus();
    fetchActiveProjects();

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
        } else {
          setWalletAddress('');
        }
      });
      window.ethereum.on('chainChanged', (hexChainId) => {
        setChainId(hexChainId);
        if (hexChainId !== '0x7a69') {
          setWrongNetwork(true);
          setWeb3Error('Network mismatch: please switch MetaMask to Hardhat Local Node (Chain ID: 31337).');
        } else {
          setWrongNetwork(false);
          setWeb3Error('');
        }
      });
    }
  }, [user]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegError(null);
    setRegSuccess(null);
    try {
      const res = await registerUser({
        name: regName,
        email: regEmail,
        password: regPassword,
        role: regRole,
      });

      if (res.ok) {
        setRegSuccess('Registration successful! Please login.');
        setRegName('');
        setRegEmail('');
        setRegPassword('');
        setView('login');
      } else {
        setRegError(res.data.error?.message || 'Registration failed');
      }
    } catch (err) {
      setRegError('Registration failed: server error');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await loginUser({
        email: loginEmail,
        password: loginPassword,
      });

      if (res.ok) {
        const profile = res.data.user;
        setUser(profile);
        localStorage.setItem('user_profile', JSON.stringify(profile));
        setLoginEmail('');
        setLoginPassword('');
        setView('dashboard');
      } else {
        setLoginError(res.data.error?.message || 'Login failed');
      }
    } catch (err) {
      setLoginError('Login failed: server error');
    }
  };

  const handleLogout = () => {
    logoutUser();
    setUser(null);
    localStorage.removeItem('user_profile');
    setView('home');
  };

  // --- NGO Action Handlers ---
  const fetchNgoData = async () => {
    try {
      const resProfile = await getNgoProfile();
      if (resProfile.ok) {
        setNgoProfile(resProfile.data.profile);
        setEditNgoName(resProfile.data.profile.name);
        setEditNgoDesc(resProfile.data.profile.description);
        setEditNgoReg(resProfile.data.profile.registrationNumber);
        setEditNgoWallet(resProfile.data.profile.walletAddress);
      }
      const resProjects = await getOwnProjects();
      if (resProjects.ok) {
        setNgoProjects(resProjects.data.projects);
      }
      const resDons = await getNgoDonations();
      if (resDons.ok) {
        setNgoDonations(resDons.data.donations);
      }
      const resTot = await getNgoDonationsTotal();
      if (resTot.ok) {
        setNgoTotalReceived(resTot.data.total);
      }
    } catch (err) {
      console.error('Error fetching NGO data:', err);
    }
  };

  const handleUpdateNgoProfile = async (e) => {
    e.preventDefault();
    setNgoProfileError(null);
    try {
      const res = await updateNgoProfile({
        name: editNgoName,
        description: editNgoDesc,
        registrationNumber: editNgoReg,
        walletAddress: editNgoWallet,
      });
      if (res.ok) {
        setNgoProfile(res.data.profile);
        setIsEditingProfile(false);
      } else {
        setNgoProfileError(res.data.error?.message || 'Failed to update profile');
      }
    } catch (err) {
      setNgoProfileError('Server error updating profile');
    }
  };

  const addMilestone = () => {
    if (!msTitle || msAmount <= 0) return;
    setProjMilestones([
      ...projMilestones,
      {
        title: msTitle,
        description: msDesc,
        amount: Number(msAmount),
        order: projMilestones.length + 1,
      },
    ]);
    setMsTitle('');
    setMsDesc('');
    setMsAmount(0);
  };

  const removeMilestone = (index) => {
    const updated = projMilestones.filter((_, i) => i !== index);
    const reindexed = updated.map((m, idx) => ({ ...m, order: idx + 1 }));
    setProjMilestones(reindexed);
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setProjError(null);

    if (!window.ethereum) {
      setProjError('MetaMask extension is required to register campaigns on-chain.');
      return;
    }

    try {
      setWeb3Status('CONNECTING');
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
      
      if (currentChainId !== '0x7a69' && currentChainId !== 31337 && currentChainId !== '31337') {
        setProjError('Wrong network: please connect to Hardhat Local Node (Chain ID: 31337).');
        return;
      }

      setWeb3Status('SIGNING');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // Deploy contract configuration imports
      const contractConfig = await import('./contract_config.json');
      const contract = new ethers.Contract(contractConfig.address, contractConfig.abi, signer);

      // On-chain registration parameters formatting
      const targetWei = ethers.parseEther(projTarget.toString());
      const milestoneTitles = projMilestones.map(m => m.title);
      const milestoneWeiAmounts = projMilestones.map(m => ethers.parseEther(m.amount.toString()));

      // Send transaction
      const tx = await contract.createProject(
        ngoProfile?.walletAddress || accounts[0],
        targetWei,
        milestoneTitles,
        milestoneWeiAmounts
      );

      setWeb3Status('PENDING');
      const txReceipt = await tx.wait();

      if (txReceipt.status !== 1) {
        throw new Error('On-chain project creation failed');
      }

      // Parse project ID from events
      // Event: ProjectCreated(uint256 indexed projectId, address indexed ngo, uint256 targetAmount)
      let onChainProjectId = 0;
      for (const log of txReceipt.logs) {
        try {
          const parsedLog = contract.interface.parseLog(log);
          if (parsedLog && parsedLog.name === 'ProjectCreated') {
            onChainProjectId = Number(parsedLog.args.projectId);
            break;
          }
        } catch (e) {
          // ignore parsing error for non-target logs
        }
      }

      // Now create database project
      setWeb3Status('SUCCESS');
      const res = await createProject({
        title: projTitle,
        description: projDesc,
        targetAmount: Number(projTarget),
        startDate: projStart,
        endDate: projEnd,
        status: projStatus,
        milestones: projMilestones,
        blockchainId: onChainProjectId,
      });

      if (res.ok) {
        setProjTitle('');
        setProjDesc('');
        setProjTarget(0);
        setProjStart('');
        setProjEnd('');
        setProjMilestones([]);
        setIsCreatingProject(false);
        fetchNgoData();
      } else {
        setProjError(res.data.error?.message || 'Database creation failed');
      }
      setWeb3Status('IDLE');
    } catch (err) {
      setWeb3Status('IDLE');
      if (err.code === 'ACTION_REJECTED' || err.code === 4001 || (err.message && err.message.includes('rejected'))) {
        setProjError('Transaction rejected by user.');
      } else {
        setProjError('On-chain deployment failed: ' + err.message);
      }
    }
  };

  // --- Donor Action Handlers ---
  const fetchActiveProjects = async () => {
    try {
      const res = await getActiveProjects();
      if (res.ok) {
        setActiveProjects(res.data.projects);
      }
    } catch (err) {
      console.error('Error fetching active projects:', err);
    }
  };

  const fetchDonorHistory = async () => {
    try {
      const res = await getDonationHistory();
      if (res.ok) {
        setDonationHistory(res.data.donations);
      }
    } catch (err) {
      console.error('Error loading donation history:', err);
    }
  };

  const handleViewProjectDetails = async (projectId) => {
    setProjDetailError(null);
    setSelectedProject(null);
    setDonationError(null);
    setDonationSuccess(null);
    setDonationAmount(0);
    setWeb3Error('');
    setWeb3Status('IDLE');
    setUploadError(null);
    setUploadSuccess(null);
    setSelectedFile(null);
    try {
      const res = await getProjectDetails(projectId);
      if (res.ok) {
        setSelectedProject(res.data.project);
        // Fetch project documents
        const resDocs = await getProjectDocuments(projectId);
        if (resDocs.ok) {
          setProjectDocuments(resDocs.data.documents);
        }
        setView('project-details');
      } else {
        setProjDetailError(res.data.error?.message || 'Failed to load details');
      }
    } catch (err) {
      setProjDetailError('Server error loading details');
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    setUploadError(null);
    setUploadSuccess(null);

    if (!selectedFile) {
      setUploadError('Please select a file to upload');
      return;
    }

    try {
      const res = await uploadProjectDocument(selectedProject._id, selectedFile);
      if (res.ok) {
        setUploadSuccess('Document uploaded to IPFS successfully!');
        setSelectedFile(null);
        const fileInput = document.getElementById('project-document-file-input');
        if (fileInput) fileInput.value = '';
        
        // Refresh document list
        const resDocs = await getProjectDocuments(selectedProject._id);
        if (resDocs.ok) {
          setProjectDocuments(resDocs.data.documents);
        }
      } else {
        setUploadError(res.data.error?.message || 'Document upload failed');
      }
    } catch (err) {
      setUploadError('Server error uploading document');
    }
  };

  const handleFileDelete = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      const res = await deleteProjectDocument(docId);
      if (res.ok) {
        // Refresh document list
        const resDocs = await getProjectDocuments(selectedProject._id);
        if (resDocs.ok) {
          setProjectDocuments(resDocs.data.documents);
        }
      } else {
        alert(res.data.error?.message || 'Failed to delete document');
      }
    } catch (err) {
      alert('Server error deleting document');
    }
  };

  const handleImpactAnalysis = async (e) => {
    e.preventDefault();
    setImpactError(null);
    setImpactResult(null);
    setImpactLoading(true);

    if (!impactText.trim()) {
      setImpactError('Please provide report text for analysis');
      setImpactLoading(false);
      return;
    }

    try {
      const res = await analyseProjectImpact(selectedProject._id, impactText);
      if (res.ok && res.data.success) {
        setImpactResult(res.data.impactAnalysis);
        setImpactText('');
        // Refresh project details to show stored analysis
        const resUpdated = await getProjectDetails(selectedProject._id);
        if (resUpdated.ok) {
          setSelectedProject(resUpdated.data.project);
        }
      } else {
        setImpactError(res.data.error?.message || 'Impact analysis failed');
      }
    } catch (err) {
      setImpactError('Server error during impact analysis');
    } finally {
      setImpactLoading(false);
    }
  };

  const handleDonate = async (e) => {
    e.preventDefault();
    setDonationError(null);
    setDonationSuccess(null);
    setWeb3Error('');

    if (donationAmount <= 0) {
      setDonationError('Donation amount must be greater than zero');
      return;
    }

    if (!window.ethereum) {
      setDonationError('MetaMask extension is required to make blockchain contributions.');
      return;
    }

    // Connect wallet if not already connected
    let activeAddress = walletAddress;
    try {
      if (!activeAddress) {
        setWeb3Status('CONNECTING');
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        activeAddress = accounts[0];
        setWalletAddress(activeAddress);
      }
      
      const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (currentChainId !== '0x7a69' && currentChainId !== 31337 && currentChainId !== '31337') {
        setWrongNetwork(true);
        setDonationError('Wrong network: please connect MetaMask to the Hardhat network (Chain ID: 31337).');
        return;
      }
    } catch (err) {
      setWeb3Status('IDLE');
      setDonationError('Wallet connection rejected: ' + err.message);
      return;
    }

    // Generate unique idempotency key
    const idempotencyKey = 'key_' + Math.random().toString(36).substring(2) + Date.now().toString(36);

    try {
      // 1. Connect to smart contract
      setWeb3Status('SIGNING');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // Load configuration dynamically
      const contractConfig = await import('./contract_config.json');
      const contract = new ethers.Contract(contractConfig.address, contractConfig.abi, signer);

      // 2. Trigger smart contract transaction (MetaMask signing)
      // Call contract: donate(projectId)
      const txVal = ethers.parseEther(donationAmount.toString());
      const tx = await contract.donate(selectedProject.blockchainId || 0, {
        value: txVal,
      });

      // 3. Wait for blockchain confirmation
      setWeb3Status('PENDING');
      const txReceipt = await tx.wait(); // txReceipt status will be 1 if success

      if (txReceipt.status !== 1) {
        throw new Error('On-chain transaction failed');
      }

      // 4. Send transaction receipt details to backend
      setWeb3Status('SUCCESS');
      const res = await donateToProject(selectedProject._id, Number(donationAmount), idempotencyKey, tx.hash);
      
      if (res.ok) {
        setDonationSuccess(`Donation of $${donationAmount} succeeded! Tx Hash: ${tx.hash}`);
        setDonationAmount(0);
        // Refresh project details
        const resUpdated = await getProjectDetails(selectedProject._id);
        if (resUpdated.ok) {
          setSelectedProject(resUpdated.data.project);
        }
      } else {
        setDonationError(res.data.error?.message || 'Database registration failed');
      }
      setWeb3Status('IDLE');
    } catch (err) {
      setWeb3Status('IDLE');
      if (err.code === 'ACTION_REJECTED' || err.code === 4001 || (err.message && err.message.includes('rejected'))) {
        setDonationError('Transaction rejected by user.');
      } else if (err.code === 'INSUFFICIENT_FUNDS' || (err.message && err.message.includes('insufficient funds'))) {
        setDonationError('Transaction failed: Insufficient funds in wallet.');
      } else {
        setDonationError('Transaction failed: ' + (err.reason || err.message));
      }
    }
  };

  // --- Admin Action Handlers ---
  const fetchAdminData = async () => {
    setAdminError(null);
    try {
      const resNgos = await adminGetNgos();
      const resProjs = await adminGetProjects();
      const resTxs = await adminGetTransactions();

      if (resNgos.ok && resProjs.ok && resTxs.ok) {
        setAdminNgos(resNgos.data.ngos);
        setAdminProjects(resProjs.data.projects);
        setAdminTransactions(resTxs.data.transactions);
      } else {
        setAdminError('Failed to fetch administrative data listings');
      }
    } catch (err) {
      setAdminError('Server error pulling admin logs');
    }
  };

  const handleVerifyNgo = async (ngoProfileId) => {
    try {
      const res = await adminVerifyNgo(ngoProfileId);
      if (res.ok) {
        fetchAdminData();
      } else {
        alert(res.data.error?.message || 'Verification failed');
      }
    } catch (err) {
      alert('Verification server error');
    }
  };

  const handleUpdateReview = async (transactionId, reviewStatus) => {
    try {
      const res = await adminUpdateTransactionReview(transactionId, reviewStatus);
      if (res.ok) {
        fetchAdminData();
      } else {
        alert(res.data.error?.message || 'Failed to update review status');
      }
    } catch (err) {
      alert('Server error updating review status');
    }
  };

  useEffect(() => {
    if (view === 'dashboard' && user) {
      if (user.role === 'NGO') fetchNgoData();
      else if (user.role === 'ADMIN') fetchAdminData();
      else if (user.role === 'DONOR') fetchDonorHistory();
    }
  }, [view, user]);

  return (
    <div>
      {/* Navigation */}
      <nav style={{ background: '#333', padding: '10px 20px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 'bold', fontSize: '1.2em', cursor: 'pointer' }} onClick={() => setView('home')}>Major R App</span>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <button style={{ background: 'transparent', color: 'white', border: 'none', cursor: 'pointer' }} onClick={() => setView('home')}>Home</button>
          {!user ? (
            <>
              <button style={{ background: 'transparent', color: 'white', border: 'none', cursor: 'pointer' }} onClick={() => setView('login')}>Login</button>
              <button style={{ background: 'transparent', color: 'white', border: 'none', cursor: 'pointer' }} onClick={() => setView('register')}>Register</button>
            </>
          ) : (
            <>
              <button style={{ background: 'transparent', color: 'white', border: 'none', cursor: 'pointer' }} onClick={() => setView('dashboard')}>Dashboard</button>
              <button style={{ background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer' }} onClick={handleLogout}>Logout</button>
            </>
          )}

          {/* Web3 Wallet Connect nav block */}
          {window.ethereum && (
            <button 
              onClick={connectWallet} 
              style={{
                background: wrongNetwork ? '#dc3545' : walletAddress ? '#28a745' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '5px 10px',
                cursor: 'pointer'
              }}
            >
              {wrongNetwork ? 'Wrong Network' : walletAddress ? `${walletAddress.substring(0, 6)}...${walletAddress.substring(38)}` : 'Connect Wallet'}
            </button>
          )}
        </div>
      </nav>

      <div className="container">
        {/* Error notification header */}
        {web3Error && (
          <div style={{ background: '#f8d7da', border: '1px solid #f5c6cb', color: '#721c24', padding: '10px', borderRadius: '4px', marginTop: '15px', textAlign: 'left' }}>
            <strong>Web3 Status Alert:</strong> {web3Error}
          </div>
        )}

        {/* Home View */}
        {view === 'home' && (
          <header>
            <h1>Major R Project Foundation</h1>
            <p style={{ color: '#28a745', fontWeight: 'bold' }}>✓ React Frontend is successfully running!</p>

            {user && <p style={{ color: '#007bff' }}>Logged in as: <strong>{user.name}</strong> ({user.role})</p>}
            {walletAddress && <p style={{ color: '#28a745' }}>MetaMask Connected: <strong>{walletAddress}</strong></p>}

            <section style={{ marginTop: '30px' }}>
              <h2>Active Campaigns to Support</h2>
              {activeProjects.length === 0 ? (
                <p>No active donation opportunities available at the moment.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', marginTop: '20px', textAlign: 'left' }}>
                  {activeProjects.map(p => (
                    <div key={p._id} style={{ border: '1px solid #ddd', borderRadius: '6px', padding: '15px', background: 'white' }}>
                      <h3>{p.title}</h3>
                      <p>{p.description.substring(0, 100)}...</p>
                      <p><strong>Target:</strong> {p.targetAmount} ETH</p>
                      <p><strong>Raised:</strong> {p.raisedAmount} ETH</p>
                      <button onClick={() => handleViewProjectDetails(p._id)}>View Details</button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={{ marginTop: '50px', borderTop: '2px solid #eee', paddingTop: '30px' }}>
              <h2>System Health Diagnostics</h2>
              {healthLoading && <div className="status-card status-loading">Checking backend connectivity...</div>}
              {!healthLoading && healthError && <div className="status-card status-down">Error: {healthError}</div>}
              {!healthLoading && healthInfo && (
                <div>
                  <div className={`status-card ${healthInfo.status === 'UP' ? 'status-up' : 'status-down'}`}>
                    Overall System: {healthInfo.status}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '20px' }}>
                    <div>
                      <h3>Express Backend</h3>
                      <span className={`status-card ${healthInfo.services?.backend === 'UP' ? 'status-up' : 'status-down'}`} style={{ display: 'inline-block', padding: '10px 20px' }}>
                        {healthInfo.services?.backend}
                      </span>
                    </div>
                    <div>
                      <h3>MongoDB Database</h3>
                      <span className={`status-card ${healthInfo.services?.database === 'UP' ? 'status-up' : 'status-down'}`} style={{ display: 'inline-block', padding: '10px 20px' }}>
                        {healthInfo.services?.database}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <button onClick={fetchHealthStatus} disabled={healthLoading} style={{ marginTop: '10px' }}>Check Health Again</button>
            </section>
          </header>
        )}

        {/* Project Details View */}
        {view === 'project-details' && selectedProject && (
          <section style={{ textAlign: 'left' }}>
            <button onClick={() => setView(user ? 'dashboard' : 'home')}>← Back</button>
            <h2 style={{ marginTop: '20px' }}>{selectedProject.title}</h2>
            <div style={{ padding: '20px', background: 'white', borderRadius: '8px', border: '1px solid #ddd' }}>
              <p><strong>Description:</strong> {selectedProject.description}</p>
              <p><strong>Target amount:</strong> {selectedProject.targetAmount} ETH</p>
              <p><strong>Raised amount:</strong> {selectedProject.raisedAmount} ETH</p>
              <p><strong>On-Chain Campaign ID:</strong> <code>{selectedProject.blockchainId || 0}</code></p>
              <p><strong>StartDate:</strong> {new Date(selectedProject.startDate).toLocaleDateString()}</p>
              <p><strong>EndDate:</strong> {new Date(selectedProject.endDate).toLocaleDateString()}</p>
              <p><strong>Status:</strong> <span style={{ background: '#28a745', color: 'white', padding: '2px 8px', borderRadius: '4px' }}>{selectedProject.status}</span></p>

              {/* Donation form for Donors */}
              {user && user.role === 'DONOR' && selectedProject.status === 'ACTIVE' && (
                <div style={{ background: '#fff3cd', padding: '15px', borderRadius: '6px', marginTop: '20px', border: '1px solid #ffeeba' }}>
                  <h4>Support this Campaign (via MetaMask)</h4>
                  {donationError && <div className="status-card status-down">{donationError}</div>}
                  {donationSuccess && <div className="status-card status-up">{donationSuccess}</div>}
                  
                  {web3Status !== 'IDLE' && (
                    <div style={{ background: '#e2f0d9', color: '#385723', padding: '10px', borderRadius: '4px', marginBottom: '10px' }}>
                      Status: <strong>
                        {web3Status === 'CONNECTING' && 'Connecting to MetaMask...'}
                        {web3Status === 'SIGNING' && 'Awaiting transaction signature on MetaMask...'}
                        {web3Status === 'PENDING' && 'Transaction pending on blockchain network...'}
                        {web3Status === 'SUCCESS' && 'Transaction confirmed! Resolving ledger details...'}
                      </strong>
                    </div>
                  )}

                  <form onSubmit={handleDonate} style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '5px' }}>Donation Amount (ETH)</label>
                      <input type="number" step="any" value={donationAmount} onChange={(e) => setDonationAmount(e.target.value)} required min="0.0001" style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
                    </div>
                    <button type="submit" disabled={web3Status === 'SIGNING' || web3Status === 'PENDING'} style={{ marginTop: '24px' }}>
                      {walletAddress ? 'Send Contribution' : 'Connect Wallet & Donate'}
                    </button>
                  </form>
                </div>
              )}

              <h3 style={{ marginTop: '30px' }}>Linked NGO Profile</h3>
              <div style={{ padding: '15px', background: '#f8f9fa', borderRadius: '6px', border: '1px solid #eee' }}>
                <p><strong>Name:</strong> {selectedProject.ngoDetails?.name}</p>
                <p><strong>Registration Number:</strong> {selectedProject.ngoDetails?.registrationNumber}</p>
                <p><strong>Description:</strong> {selectedProject.ngoDetails?.description || 'N/A'}</p>
                <p><strong>Wallet Address:</strong> {selectedProject.ngoDetails?.walletAddress || 'N/A'}</p>
                <p><strong>Verification status:</strong> {selectedProject.ngoDetails?.verified ? '✅ Verified' : '❌ Unverified'}</p>
              </div>

              <h3 style={{ marginTop: '30px' }}>Campaign Milestones</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f1f1f1', borderBottom: '2px solid #ddd' }}>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Order</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Title</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Description</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Allocation (ETH)</th>
                    <th style={{ padding: '10px', textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedProject.milestones?.map(m => (
                    <tr key={m._id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '10px' }}>{m.order}</td>
                      <td style={{ padding: '10px' }}>{m.title}</td>
                      <td style={{ padding: '10px' }}>{m.description}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{m.amount} ETH</td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>{m.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3 style={{ marginTop: '40px' }}>Campaign Supporting Documents (IPFS)</h3>
              
              {/* Upload panel only for project's NGO owner */}
              {user && user.role === 'NGO' && selectedProject.ngoId === user._id && (
                <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '6px', marginTop: '15px', border: '1px solid #ddd' }}>
                  <h4 style={{ margin: '0 0 10px 0' }}>Upload Support Document (PDF/Image to IPFS)</h4>
                  {uploadError && <div className="status-card status-down" style={{ padding: '6px', margin: '0 0 10px 0' }}>{uploadError}</div>}
                  {uploadSuccess && <div className="status-card status-up" style={{ padding: '6px', margin: '0 0 10px 0' }}>{uploadSuccess}</div>}
                  <form onSubmit={handleFileUpload} style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <input 
                      type="file" 
                      id="project-document-file-input"
                      onChange={(e) => setSelectedFile(e.target.files[0])}
                      required 
                      accept=".pdf,image/png,image/jpeg,image/jpg" 
                    />
                    <button type="submit">Upload to IPFS</button>
                  </form>
                </div>
              )}

              {/* Document Lists Table */}
              <div style={{ marginTop: '15px' }}>
                {projectDocuments.length === 0 ? (
                  <p style={{ color: '#666', fontStyle: 'italic' }}>No supporting documents uploaded for this campaign yet.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                    <thead>
                      <tr style={{ background: '#f1f1f1', borderBottom: '2px solid #ddd' }}>
                        <th style={{ padding: '10px', textAlign: 'left' }}>File Name</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Mime Type</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>IPFS CID</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectDocuments.map(doc => {
                        const isOwner = user && (
                          doc.uploadedBy === user._id || 
                          doc.uploadedBy?._id === user._id || 
                          doc.uploadedBy?.toString() === user._id?.toString()
                        );
                        return (
                          <tr key={doc._id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '10px' }}>{doc.fileName}</td>
                            <td style={{ padding: '10px' }}>{doc.mimeType}</td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              <code style={{ fontSize: '0.85em', background: '#f4f4f4', padding: '2px 5px', borderRadius: '3px' }}>{doc.ipfsCid}</code>
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                <a 
                                  href={`http://localhost:5000/api/documents/${doc.ipfsCid}/download`} 
                                  download 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  style={{ background: '#28a745', color: 'white', textDecoration: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '0.9em', display: 'inline-block' }}
                                >
                                  Download
                                </a>
                                {isOwner && (
                                  <button 
                                    onClick={() => handleFileDelete(doc._id)}
                                    style={{ background: '#dc3545', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9em' }}
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Impact Analysis Section */}
              <h3 style={{ marginTop: '40px' }}>AI-Assisted Impact Analysis</h3>
              
              {/* Show existing analysis result if available */}
              {selectedProject.impactAnalysis?.impactLevel && (
                <div style={{ background: '#f0f8ff', padding: '20px', borderRadius: '8px', border: '1px solid #b8daff', marginTop: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h4 style={{ margin: 0 }}>Assessment Result</h4>
                    <span style={{
                      padding: '5px 15px', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.9em',
                      background: selectedProject.impactAnalysis.impactLevel === 'HIGH' ? '#28a745' : selectedProject.impactAnalysis.impactLevel === 'MEDIUM' ? '#ffc107' : '#dc3545',
                      color: selectedProject.impactAnalysis.impactLevel === 'MEDIUM' ? '#333' : 'white',
                    }}>
                      {selectedProject.impactAnalysis.impactLevel} IMPACT
                    </span>
                  </div>
                  <p><strong>Impact Score:</strong> {selectedProject.impactAnalysis.impactScore} / 10</p>
                  <p><strong>Completeness:</strong> {(selectedProject.impactAnalysis.completenessScore * 100).toFixed(0)}%</p>
                  <p><strong>Confidence:</strong> {(selectedProject.impactAnalysis.confidenceScore * 100).toFixed(0)}%</p>
                  <p><strong>Summary:</strong> {selectedProject.impactAnalysis.generatedSummary}</p>
                  {selectedProject.impactAnalysis.limitations?.length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <strong>Limitations:</strong>
                      <ul style={{ margin: '5px 0' }}>
                        {selectedProject.impactAnalysis.limitations.map((l, i) => <li key={i}>{l}</li>)}
                      </ul>
                    </div>
                  )}
                  <p style={{ fontSize: '0.8em', color: '#666', fontStyle: 'italic', marginTop: '10px' }}>
                    {selectedProject.impactAnalysis.disclaimer || 'This is an AI-assisted assessment and does not objectively prove social impact.'}
                  </p>
                  <p style={{ fontSize: '0.75em', color: '#999' }}>
                    Analysed: {new Date(selectedProject.impactAnalysis.analysedAt).toLocaleString()}
                  </p>
                </div>
              )}

              {selectedProject.impactAnalysis?.error && !selectedProject.impactAnalysis?.impactLevel && (
                <div className="status-card status-down" style={{ marginTop: '10px' }}>
                  Previous analysis error: {selectedProject.impactAnalysis.error}
                </div>
              )}

              {/* NGO owner can submit report text for analysis */}
              {user && user.role === 'NGO' && selectedProject.ngoId === user._id && (
                <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '6px', marginTop: '15px', border: '1px solid #ddd' }}>
                  <h4 style={{ margin: '0 0 10px 0' }}>Submit Project Report for AI Analysis</h4>
                  <p style={{ fontSize: '0.85em', color: '#666' }}>Paste your project report text below. The AI will extract impact indicators, assess completeness, and generate a structured analysis.</p>
                  {impactError && <div className="status-card status-down" style={{ padding: '6px', margin: '0 0 10px 0' }}>{impactError}</div>}
                  <form onSubmit={handleImpactAnalysis}>
                    <textarea
                      value={impactText}
                      onChange={(e) => setImpactText(e.target.value)}
                      placeholder="Paste project report content here..."
                      required
                      style={{ width: '100%', minHeight: '150px', padding: '10px', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
                    />
                    <button type="submit" disabled={impactLoading} style={{ marginTop: '10px' }}>
                      {impactLoading ? 'Analysing...' : 'Run Impact Analysis'}
                    </button>
                  </form>
                </div>
              )}

            </div>
          </section>
        )}

        {/* Register View */}
        {view === 'register' && (
          <section style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'left' }}>
            <h2>Create Account</h2>
            {regError && <div className="status-card status-down">{regError}</div>}
            {regSuccess && <div className="status-card status-up">{regSuccess}</div>}
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px' }}>Full Name</label>
                <input type="text" value={regName} onChange={(e) => setRegName(e.target.value)} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px' }}>Email</label>
                <input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px' }}>Password (min 8 chars)</label>
                <input type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px' }}>Account Role</label>
                <select value={regRole} onChange={(e) => setRegRole(e.target.value)} style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}>
                  <option value="DONOR">Donor</option>
                  <option value="NGO">NGO</option>
                </select>
              </div>
              <button type="submit" style={{ width: '100%' }}>Register</button>
            </form>
          </section>
        )}

        {/* Login View */}
        {view === 'login' && (
          <section style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'left' }}>
            <h2>Login</h2>
            {loginError && <div className="status-card status-down">{loginError}</div>}
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px' }}>Email</label>
                <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px' }}>Password</label>
                <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
              </div>
              <button type="submit" style={{ width: '100%' }}>Login</button>
            </form>
          </section>
        )}

        {/* Dashboards */}
        {view === 'dashboard' && user && (
          <section style={{ textAlign: 'left' }}>
            <h2>{user.role} Dashboard</h2>

            {/* Donor Dashboard */}
            {user.role === 'DONOR' && (
              <div>
                <p>Welcome back, donor supporter <strong>{user.name}</strong>!</p>
                <button onClick={() => setView('home')} style={{ marginBottom: '30px' }}>Browse Active Projects</button>

                <h3>My Donation History</h3>
                {donationHistory.length === 0 ? (
                  <p>You have not made any donations yet.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f1f1f1', borderBottom: '2px solid #ddd' }}>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Project Campaign</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Amount (ETH)</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>Blockchain Tx</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {donationHistory.map(d => (
                        <tr key={d._id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '10px' }}>{d.projectId?.title || 'Unknown Project'}</td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>{d.amount} ETH</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            {d.transactionHash ? (
                              <a href="#" onClick={(e) => { e.preventDefault(); alert(`Blockchain Transaction Details:\nTx Hash: ${d.transactionHash}\nBlock: ${d.blockNumber}\nFrom Address: ${d.fromAddress}\nContract Address: ${d.toAddress}\nGas Used: ${d.gasUsed}`); }} style={{ color: '#007bff', textDecoration: 'underline', cursor: 'pointer' }}>
                                View Transaction
                              </a>
                            ) : 'N/A'}
                          </td>
                          <td style={{ padding: '10px' }}>{new Date(d.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* NGO Dashboard */}
            {user.role === 'NGO' && (
              <div>
                {/* Profile section */}
                <div style={{ background: '#f8f9fa', border: '1px solid #ddd', padding: '20px', borderRadius: '6px', marginBottom: '30px' }}>
                  <h3>NGO Profile Details</h3>
                  {ngoProfileError && <div className="status-card status-down">{ngoProfileError}</div>}
                  {!isEditingProfile ? (
                    <div>
                      {ngoProfile ? (
                        <>
                          <p><strong>Name:</strong> {ngoProfile.name}</p>
                          <p><strong>Description:</strong> {ngoProfile.description || 'No description provided yet.'}</p>
                          <p><strong>Registration Number:</strong> {ngoProfile.registrationNumber}</p>
                          <p><strong>Wallet Address (Receives Escrow Releases):</strong> <code>{ngoProfile.walletAddress || 'N/A'}</code></p>
                          <p><strong>Verification Status:</strong> {ngoProfile.verified ? '✅ Verified' : '❌ Unverified'}</p>
                        </>
                      ) : <p>Loading profile details...</p>}
                      <button onClick={() => setIsEditingProfile(true)}>Edit Profile</button>
                    </div>
                  ) : (
                    <form onSubmit={handleUpdateNgoProfile} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '5px' }}>NGO Name</label>
                        <input type="text" value={editNgoName} onChange={(e) => setEditNgoName(e.target.value)} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Registration Number</label>
                        <input type="text" value={editNgoReg} onChange={(e) => setEditNgoReg(e.target.value)} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Description</label>
                        <textarea value={editNgoDesc} onChange={(e) => setEditNgoDesc(e.target.value)} style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Wallet Address</label>
                        <input type="text" value={editNgoWallet} onChange={(e) => setEditNgoWallet(e.target.value)} style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button type="submit">Save Updates</button>
                        <button type="button" onClick={() => setIsEditingProfile(false)} style={{ background: '#6c757d' }}>Cancel</button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Received Donations aggregate info */}
                <div style={{ background: '#d4edda', border: '1px solid #c3e6cb', padding: '20px', borderRadius: '6px', color: '#155724', marginBottom: '30px' }}>
                  <h3>Campaign Ledger Overview</h3>
                  <p style={{ fontSize: '1.5em', margin: 0 }}>Total Contributions Received: <strong>{ngoTotalReceived} ETH</strong></p>
                </div>

                {/* Donations received lists */}
                <div style={{ marginBottom: '30px' }}>
                  <h3>Received Contribution Details</h3>
                  {ngoDonations.length === 0 ? (
                    <p>No contributions received yet.</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f1f1f1', borderBottom: '2px solid #ddd' }}>
                          <th style={{ padding: '10px', textAlign: 'left' }}>Campaign</th>
                          <th style={{ padding: '10px', textAlign: 'left' }}>Donor</th>
                          <th style={{ padding: '10px', textAlign: 'right' }}>Amount (ETH)</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>Blockchain Info</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ngoDonations.map(d => (
                          <tr key={d._id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '10px' }}>{d.projectId?.title}</td>
                            <td style={{ padding: '10px' }}>{d.donorId?.name}</td>
                            <td style={{ padding: '10px', textAlign: 'right' }}>{d.amount} ETH</td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              {d.transactionHash ? (
                                <button onClick={() => alert(`Blockchain Details:\nTx Hash: ${d.transactionHash}\nBlock: ${d.blockNumber}\nFrom Address: ${d.fromAddress}\nGas Used: ${d.gasUsed}`)}>
                                  View Audit Data
                                </button>
                              ) : 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Campaign Creator & listings */}
                <div style={{ marginBottom: '30px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3>Our Campaigns</h3>
                    <button onClick={() => setIsCreatingProject(!isCreatingProject)}>
                      {isCreatingProject ? 'Cancel Campaign Creation' : 'Create New Campaign'}
                    </button>
                  </div>

                  {isCreatingProject && (
                    <div style={{ background: '#fff', border: '1px solid #ddd', padding: '20px', borderRadius: '6px', marginTop: '15px' }}>
                      <h4>Create Project Campaign (Registers On-Chain via MetaMask)</h4>
                      {projError && <div className="status-card status-down">{projError}</div>}
                      
                      {web3Status !== 'IDLE' && (
                        <div style={{ background: '#e2f0d9', color: '#385723', padding: '10px', borderRadius: '4px', marginBottom: '10px' }}>
                          Status: <strong>
                            {web3Status === 'CONNECTING' && 'Connecting to MetaMask...'}
                            {web3Status === 'SIGNING' && 'Awaiting transaction signature on MetaMask...'}
                            {web3Status === 'PENDING' && 'Deploying project campaign details to blockchain network...'}
                            {web3Status === 'SUCCESS' && 'Transaction confirmed! Syncing database record...'}
                          </strong>
                        </div>
                      )}

                      <form onSubmit={handleCreateProject} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '5px' }}>Campaign Title</label>
                          <input type="text" value={projTitle} onChange={(e) => setProjTitle(e.target.value)} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '5px' }}>Campaign Description</label>
                          <textarea value={projDesc} onChange={(e) => setProjDesc(e.target.value)} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '5px' }}>Funding Target (ETH)</label>
                          <input type="number" value={projTarget} onChange={(e) => setProjTarget(e.target.value)} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ display: 'flex', gap: '15px' }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '5px' }}>Start Date</label>
                            <input type="date" value={projStart} onChange={(e) => setProjStart(e.target.value)} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '5px' }}>End Date</label>
                            <input type="date" value={projEnd} onChange={(e) => setProjEnd(e.target.value)} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
                          </div>
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '5px' }}>Initial Status</label>
                          <select value={projStatus} onChange={(e) => setProjStatus(e.target.value)} style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}>
                            <option value="DRAFT">Draft</option>
                            <option value="ACTIVE">Active</option>
                          </select>
                        </div>

                        {/* Milestones subform */}
                        <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '4px', background: '#f8f9fa' }}>
                          <h5>Milestone Allocations (Sum must equal Target amount)</h5>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
                            <input type="text" placeholder="Milestone Title" value={msTitle} onChange={(e) => setMsTitle(e.target.value)} style={{ padding: '8px' }} />
                            <input type="text" placeholder="Milestone Description" value={msDesc} onChange={(e) => setMsDesc(e.target.value)} style={{ padding: '8px' }} />
                            <input type="number" placeholder="Allocation Amount (ETH)" value={msAmount} onChange={(e) => setMsAmount(e.target.value)} style={{ padding: '8px' }} />
                            <button type="button" onClick={addMilestone} style={{ width: 'fit-content' }}>Add Milestone</button>
                          </div>

                          {projMilestones.length > 0 && (
                            <ul>
                              {projMilestones.map((m, idx) => (
                                <li key={idx} style={{ marginBottom: '5px' }}>
                                  <strong>Order {m.order}:</strong> {m.title} ({m.amount} ETH) - <em>{m.description}</em>
                                  <button type="button" onClick={() => removeMilestone(idx)} style={{ background: '#dc3545', color: 'white', padding: '2px 6px', marginLeft: '10px' }}>Remove</button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <button type="submit" disabled={web3Status === 'SIGNING' || web3Status === 'PENDING'}>
                          {walletAddress ? 'Create Campaign' : 'Connect Wallet & Create'}
                        </button>
                      </form>
                    </div>
                  )}

                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
                    <thead>
                      <tr style={{ background: '#f1f1f1', borderBottom: '2px solid #ddd' }}>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Campaign</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Target (ETH)</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Raised (ETH)</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ngoProjects.map(p => (
                        <tr key={p._id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '10px' }}>{p.title}</td>
                          <td style={{ padding: '10px' }}>{p.targetAmount} ETH</td>
                          <td style={{ padding: '10px' }}>{p.raisedAmount} ETH</td>
                          <td style={{ padding: '10px' }}>{p.status}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <button onClick={() => handleViewProjectDetails(p._id)}>View</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Admin Dashboard */}
            {user.role === 'ADMIN' && (
              <div>
                <p>Welcome back, system administrator <strong>{user.name}</strong>!</p>
                {adminError && <div className="status-card status-down">{adminError}</div>}

                <h3 style={{ marginTop: '30px' }}>Verify NGO Organizations</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
                  <thead>
                    <tr style={{ background: '#f1f1f1', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '10px', textAlign: 'left' }}>NGO Name</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Registration Number</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Verification Status</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminNgos.map(ngo => (
                      <tr key={ngo._id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '10px' }}>{ngo.name}</td>
                        <td style={{ padding: '10px' }}>{ngo.registrationNumber}</td>
                        <td style={{ padding: '10px' }}>{ngo.verified ? 'Verified' : 'Unverified'}</td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          {!ngo.verified && <button onClick={() => handleVerifyNgo(ngo._id)}>Verify NGO</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <h3>Global Contribution Ledger Audit</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
                  <thead>
                    <tr style={{ background: '#f1f1f1', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Donor</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Project Campaign</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Amount (ETH)</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>AI Risk Level</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Review Status</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Blockchain Audit</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Admin Action</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminTransactions.map(tx => {
                      const risk = tx.aiAssessment?.riskLevel;
                      const riskColors = { LOW: '#28a745', MEDIUM: '#ffc107', HIGH: '#dc3545' };
                      const riskEmoji = { LOW: '🟢', MEDIUM: '🟡', HIGH: '🔴' };
                      return (
                      <tr key={tx._id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '10px' }}>{tx.donorId?.name}</td>
                        <td style={{ padding: '10px' }}>{tx.projectId?.title}</td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>{tx.amount} ETH</td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          {risk ? (
                            <span style={{ background: riskColors[risk], color: risk === 'MEDIUM' ? '#333' : 'white', padding: '3px 10px', borderRadius: '12px', fontSize: '0.85em', fontWeight: 'bold' }}>
                              {riskEmoji[risk]} {risk}
                            </span>
                          ) : (
                            <span style={{ color: '#999' }}>{tx.aiAssessment?.error ? '⚠️ Error' : '⚪ N/A'}</span>
                          )}
                          {tx.aiAssessment?.probability != null && (
                            <div style={{ fontSize: '0.75em', color: '#666', marginTop: '2px' }}>
                              Score: {(tx.aiAssessment.probability * 100).toFixed(1)}%
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <span style={{
                            padding: '3px 8px', borderRadius: '4px', fontSize: '0.85em',
                            background: tx.reviewStatus === 'CLEARED' ? '#d4edda' : tx.reviewStatus === 'ESCALATED' ? '#f8d7da' : tx.reviewStatus === 'UNDER_REVIEW' ? '#fff3cd' : '#e2e3e5',
                            color: tx.reviewStatus === 'CLEARED' ? '#155724' : tx.reviewStatus === 'ESCALATED' ? '#721c24' : tx.reviewStatus === 'UNDER_REVIEW' ? '#856404' : '#383d41',
                          }}>
                            {tx.reviewStatus || 'PENDING_REVIEW'}
                          </span>
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          {tx.transactionHash ? (
                            <button onClick={() => alert(`Admin Audit Record:\nTx Hash: ${tx.transactionHash}\nBlock Number: ${tx.blockNumber}\nFrom Address: ${tx.fromAddress}\nTo Address: ${tx.toAddress}\nGas Used: ${tx.gasUsed}`)}>
                              Query Tx Receipt
                            </button>
                          ) : 'N/A'}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) {
                                handleUpdateReview(tx._id, e.target.value);
                                e.target.value = '';
                              }
                            }}
                            style={{ padding: '4px', fontSize: '0.85em' }}
                          >
                            <option value="" disabled>Set Status...</option>
                            <option value="UNDER_REVIEW">Under Review</option>
                            <option value="CLEARED">Cleared</option>
                            <option value="ESCALATED">Escalated</option>
                          </select>
                        </td>
                        <td style={{ padding: '10px' }}>{new Date(tx.createdAt).toLocaleString()}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>

                <h3>Global Projects Log</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f1f1f1', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Campaign Name</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Target (ETH)</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Raised (ETH)</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Impact Assessment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminProjects.map(p => {
                      const il = p.impactAnalysis?.impactLevel;
                      const impactColors = { LOW: '#dc3545', MEDIUM: '#ffc107', HIGH: '#28a745' };
                      return (
                      <tr key={p._id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '10px' }}>{p.title}</td>
                        <td style={{ padding: '10px' }}>{p.targetAmount} ETH</td>
                        <td style={{ padding: '10px' }}>{p.raisedAmount} ETH</td>
                        <td style={{ padding: '10px' }}>{p.status}</td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          {il ? (
                            <span style={{ background: impactColors[il], color: il === 'MEDIUM' ? '#333' : 'white', padding: '3px 10px', borderRadius: '12px', fontSize: '0.85em', fontWeight: 'bold' }}>
                              {il}
                            </span>
                          ) : (
                            <span style={{ color: '#999' }}>Not Analysed</span>
                          )}
                          {p.impactAnalysis?.impactScore != null && (
                            <div style={{ fontSize: '0.75em', color: '#666', marginTop: '2px' }}>
                              Score: {p.impactAnalysis.impactScore}/10
                            </div>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export default App;
