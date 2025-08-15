const express = require('express');
const router  = express.Router();
const SalesController  = require('../controllers/salesController');
const validateSale     = require('../middleware/validateSale');

router.post('/daily', validateSale, SalesController.addSale);
router.get('/daily',  SalesController.getDailySales);

router.get('/report', SalesController.getSalesReport);
module.exports = router;
