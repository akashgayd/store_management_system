const express = require('express');
const router = express.Router();

const ProductController = require('../controllers/productController');
const { validateProduct } = require('../middleware/validateMiddleware');
const { handleFileUpload } = require('../middleware/uploadMiddleware');

// POST /api/products/add - Add single product manually
router.post('/add', validateProduct, ProductController.addProduct);

// POST /api/products/upload - Upload Excel file
router.post('/upload', handleFileUpload, ProductController.uploadExcel);

module.exports = router;
