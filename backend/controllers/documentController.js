import Document from '../models/document.js';
import Project from '../models/project.js';
import { uploadToIpfs, catFromIpfs, deleteFromIpfs } from '../services/ipfsService.js';

export const uploadDocument = async (req, res, next) => {
  try {
    const { projectId } = req.body;

    // TC-3: Upload without file
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { message: 'No file uploaded', status: 400 },
      });
    }

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Project ID is required', status: 400 },
      });
    }

    // TC-2: Upload unsupported file type (only allow PDF and common images)
    const allowedMimeTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Unsupported file type. Only PDF and PNG/JPEG images are allowed.', status: 400 },
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: { message: 'Project not found', status: 404 },
      });
    }

    // TC-5: NGO uploads document to another NGO's project
    if (project.ngoId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied: you can only upload documents to your own projects', status: 403 },
      });
    }

    // Upload to IPFS mock gateway
    const cid = await uploadToIpfs(req.file.buffer);

    // Save metadata in MongoDB (TC-6, TC-10: no large file content stored in DB)
    const newDoc = new Document({
      projectId,
      uploadedBy: req.user._id,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      ipfsCid: cid,
    });

    await newDoc.save();

    return res.status(201).json({
      success: true,
      message: 'Document uploaded to IPFS successfully',
      document: newDoc,
    });
  } catch (error) {
    next(error);
  }
};

export const getProjectDocuments = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const documents = await Document.find({ projectId }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, documents });
  } catch (error) {
    next(error);
  }
};

export const downloadDocument = async (req, res, next) => {
  try {
    const { cid } = req.params;
    const documentMeta = await Document.findOne({ ipfsCid: cid });

    const buffer = await catFromIpfs(cid);

    res.setHeader('Content-Disposition', `attachment; filename="${documentMeta ? documentMeta.fileName : cid}"`);
    res.setHeader('Content-Type', documentMeta ? documentMeta.mimeType : 'application/octet-stream');
    return res.send(buffer);
  } catch (error) {
    next(error);
  }
};

export const deleteDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await Document.findById(id);

    if (!doc) {
      return res.status(404).json({
        success: false,
        error: { message: 'Document not found', status: 404 },
      });
    }

    // TC-8: Enforce uploader authorization on deletion
    if (doc.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied: you can only delete your own uploaded documents', status: 403 },
      });
    }

    // Delete from mock gateway
    await deleteFromIpfs(doc.ipfsCid);

    // Delete metadata
    await Document.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
