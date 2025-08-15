const { parseExcelFile } = require('../utils/excelParser');
const { validateBulkProducts } = require('../middleware/validateMiddleware');
const ProductModel = require('../models/productModel');

class ExcelService {
    
    static async processExcelUpload(filePath) {
        try {
            // Parse Excel file
            const rawProducts = parseExcelFile(filePath);
            
            if (rawProducts.length === 0) {
                throw new Error('No valid data found in Excel file');
            }
            
            // ✅ Clean products - remove empty keys and unwanted fields
            const cleanedProducts = rawProducts.map(product => {
                const cleaned = {};
                Object.keys(product).forEach(key => {
                    // Only keep non-empty keys and valid values
                    if (key && key.trim() !== '' && product[key] !== null && product[key] !== undefined) {
                        cleaned[key] = product[key];
                    }
                });
                return cleaned;
            }).filter(product => Object.keys(product).length > 0);
            
            console.log('Cleaned products:', JSON.stringify(cleanedProducts, null, 2));
            
            // Validate cleaned products
            const { validProducts, errors: validationErrors } = validateBulkProducts(cleanedProducts);
            
            if (validProducts.length === 0) {
                return {
                    success: false,
                    message: 'No valid products found in Excel file',
                    errors: validationErrors,
                    summary: {
                        totalRows: rawProducts.length,
                        validProducts: 0,
                        invalidProducts: validationErrors.length,
                        inserted: 0
                    }
                };
            }
            
            // Insert valid products to database
            const insertResult = await ProductModel.addBulkProducts(validProducts);
            
            // Combine all errors
            const allErrors = [...validationErrors, ...insertResult.failed];
            
            return {
                success: insertResult.successCount > 0,
                message: `Processing completed. ${insertResult.successCount} products added successfully.`,
                data: insertResult.successful,
                errors: allErrors.length > 0 ? allErrors : null,
                summary: {
                    totalRows: rawProducts.length,
                    validProducts: validProducts.length,
                    invalidProducts: validationErrors.length,
                    inserted: insertResult.successCount,
                    failed: insertResult.errorCount
                }
            };
            
        } catch (error) {
            throw new Error(`Excel processing failed: ${error.message}`);
        }
    }
}

module.exports = ExcelService;
