const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const SalesController = require('../controllers/salesController');
const validateSale = require('../middleware/validateSale');

// Multer configuration for Excel uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/excel/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'sales-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed!'), false);
    }
  }
});

// Sales routes
router.post('/', validateSale, SalesController.addSale);                    // ✅ Enhanced bulk support
router.post('/upload-excel', upload.single('excel'), SalesController.uploadSalesExcel); // ✅ NEW
router.get('/', SalesController.getDailySales);                             // ✅ Existing
router.get('/report', SalesController.getSalesReport);                      // ✅ Existing

module.exports = router;
