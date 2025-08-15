const ProductModel = require('../models/productModel');
const ExcelService = require('../services/excelService');
const { responseHelper } = require('../utils/responseHelper');

class ProductController {
    
    // Add single product manually
    static async addProduct(req, res) {
        try {
            const productData = req.body;
            
            // Check if product already exists
            const existingProduct = await ProductModel.findByName(productData.name);
            if (existingProduct) {
                return responseHelper.error(res, 'Product with this name already exists', 409);
            }
            
            // Add product to database
            const newProduct = await ProductModel.addProduct(productData);
            
            return responseHelper.success(
                res, 
                'Product added successfully', 
                newProduct, 
                201
            );
            
        } catch (error) {
            console.error('Add Product Error:', error);
            return responseHelper.error(res, error.message, 500);
        }
    }
    
    // Add products via Excel upload
    static async uploadExcel(req, res) {
        try {
            if (!req.file) {
                return responseHelper.error(res, 'Excel file is required', 400);
            }
            
            const result = await ExcelService.processExcelUpload(req.file.path);
            
            if (result.success) {
                return responseHelper.success(res, result.message, {
                    products: result.data,
                    summary: result.summary,
                    errors: result.errors
                }, 201);
            } else {
                return responseHelper.error(res, result.message, 400, result.errors);
            }
            
        } catch (error) {
            console.error('Excel Upload Error:', error);
            return responseHelper.error(res, error.message, 500);
        }
    }
}

module.exports = ProductController;
