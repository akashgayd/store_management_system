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






  // GET /api/products
  static async getProducts(req, res) {
    try {
      const { search, category, page, limit } = req.query;

      const products = await ProductModel.getProducts({
        search,
        category,
        page:  Number(page)  || 1,
        limit: Number(limit) || 20
      });

      return responseHelper.success(res, 'Products fetched', products);
    } catch (error) {
      console.error('Get Products Error:', error);
      return responseHelper.error(res, error.message, 500);
    }
  }

  // GET /api/products/:id
  static async getProduct(req, res) {
    try {
      const { id } = req.params;
      const product = await ProductModel.getProductById(id);

      if (!product) {
        return responseHelper.error(res, 'Product not found', 404);
      }
      return responseHelper.success(res, 'Product fetched', product);
    } catch (error) {
      console.error('Get Product Error:', error);
      return responseHelper.error(res, error.message, 500);
    }
  }

  // PUT /api/products/:id
static async updateProduct(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    /* optional: stop duplicate names */
    if (updates.name) {
      const dup = await ProductModel.findByName(updates.name);
      if (dup && dup.product_id !== Number(id)) {
        return responseHelper.error(res, 'Product name already in use', 409);
      }
    }

    const updated = await ProductModel.updateProduct(id, updates);
    if (!updated) return responseHelper.error(res, 'Product not found', 404);

    return responseHelper.success(res, 'Product updated', updated);
  } catch (err) {
    console.error('Update Product Error:', err);
    return responseHelper.error(res, err.message, 500);
  }
}

}

module.exports = ProductController;
