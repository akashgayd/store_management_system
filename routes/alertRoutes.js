const express = require('express');
const router = express.Router();
const AlertController = require('../controllers/alertController');

// ✅ EXISTING ROUTES - Keep as is
router.get('/recipients', AlertController.getRecipients);
router.post('/recipients', AlertController.addRecipient);
router.post('/send', AlertController.sendReport);
router.post('/test-email', AlertController.testEmail);

// ✅ NEW ROUTES - Add these
router.get('/recipients/settings', AlertController.getRecipientsWithSettings);
router.put('/recipients/:id/settings', AlertController.updateRecipientSettings);
router.post('/send-manual-report', AlertController.sendManualReport);

module.exports = router;
