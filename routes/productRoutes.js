const express = require('express');
const router = express.Router();

const ProductController = require('../controllers/productController');
const { validateProduct } = require('../middleware/validateMiddleware');
const { handleFileUpload } = require('../middleware/uploadMiddleware');
const validateProductUpdate = require('../middleware/validateProductUpdate');

// POST /api/products/add - Add single product manually
router.post('/add', validateProduct, ProductController.addProduct);

// POST /api/products/upload - Upload Excel file
router.post('/upload', handleFileUpload, ProductController.uploadExcel);


router.get('/',      ProductController.getProducts); // list / search / paginate
router.get('/:id',   ProductController.getProduct);  // single product
router.put('/:id',   validateProductUpdate, ProductController.updateProduct);  // update product

module.exports = router;
