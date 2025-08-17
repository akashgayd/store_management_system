const express = require('express');
const router = express.Router();
const PurchaseReportController = require('../controllers/purchaseReportController');

// Get purchase report
router.get('/', PurchaseReportController.getPurchaseReport);

module.exports = router;
