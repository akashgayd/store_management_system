const ProductModel = require('../models/productModel');
const ExcelService = require('../services/excelService');
const { responseHelper } = require('../utils/responseHelper');

class ProductController {
    
    // Add single product manually + auto track
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
            
            console.log('✅ Product added:', newProduct);
            
            // ✅ NEW: Auto track this purchase
            try {
                await trackPurchase({
                    purchase_date: new Date().toISOString().slice(0, 10),
                    purchase_type: 'manual_add',
                    notes: `Manual product addition: ${productData.name}`,
                    created_by: 'user'
                }, [{
                    product_id: newProduct.product_id,
                    quantity: productData.quantity || 0,
                    unit_price: productData.price || 0
                }]);
                
                console.log('✅ Purchase tracked for product:', newProduct.product_id);
                
            } catch (trackError) {
                console.error('❌ Purchase tracking failed:', trackError);
                // Continue - don't fail product addition
            }
            
            return responseHelper.success(
                res, 
                'Product added and purchase tracked', 
                newProduct, 
                201
            );
            
        } catch (error) {
            console.error('Add Product Error:', error);
            return responseHelper.error(res, error.message, 500);
        }
    }
    
    // Excel upload + auto track
    static async uploadExcel(req, res) {
        try {
            if (!req.file) {
                return responseHelper.error(res, 'Excel file is required', 400);
            }
            
            const result = await ExcelService.processExcelUpload(req.file.path);
            
            if (result.success && result.data && result.data.length > 0) {
                console.log('✅ Excel upload successful:', result.data.length, 'products');
                
                // ✅ NEW: Auto track bulk purchase
                try {
                    const purchaseItems = result.data.map(product => ({
                        product_id: product.product_id,
                        quantity: product.quantity || 0,
                        unit_price: product.price || 0
                    }));

                    await trackPurchase({
                        purchase_date: new Date().toISOString().slice(0, 10),
                        purchase_type: 'bulk_upload',
                        notes: `Excel bulk upload: ${purchaseItems.length} products`,
                        created_by: 'user'
                    }, purchaseItems);

                    console.log('✅ Bulk purchase tracked:', purchaseItems.length, 'items');
                    
                } catch (trackError) {
                    console.error('❌ Bulk purchase tracking failed:', trackError);
                    // Continue - don't fail upload
                }

                return responseHelper.success(res, 'Products uploaded and purchases tracked', {
                    products: result.data,
                    summary: result.summary,
                    errors: result.errors,
                    purchase_tracked: true
                }, 201);
            } else {
                return responseHelper.error(res, result.message, 400, result.errors);
            }
            
        } catch (error) {
            console.error('Excel Upload Error:', error);
            return responseHelper.error(res, error.message, 500);
        }
    }

    // Keep existing methods as they were
    static async getProducts(req, res) {
        try {
            const { search, category, page, limit } = req.query;
            const products = await ProductModel.getProducts({
                search, category,
                page: Number(page) || 1,
                limit: Number(limit) || 20
            });
            return responseHelper.success(res, 'Products fetched', products);
        } catch (error) {
            console.error('Get Products Error:', error);
            return responseHelper.error(res, error.message, 500);
        }
    }

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

    static async updateProduct(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;

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

// ✅ Helper function for purchase tracking
async function trackPurchase(purchaseData, items) {
    const { getPool, sql } = require('../config/db');
    const pool = getPool();
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();
        console.log('📝 Starting purchase tracking transaction');

        // Calculate total amount
        const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        console.log('💰 Total amount:', totalAmount);

        // Insert purchase header
        const headerResult = await new sql.Request(transaction)
            .input('purchase_date', sql.Date, purchaseData.purchase_date)
            .input('total_amount', sql.Decimal, totalAmount)
            .input('purchase_type', sql.VarChar, purchaseData.purchase_type)
            .input('notes', sql.NVarChar, purchaseData.notes)
            .input('created_by', sql.VarChar, purchaseData.created_by)
            .query(`
                INSERT INTO stock_purchases (purchase_date, total_amount, purchase_type, notes, created_by)
                OUTPUT INSERTED.purchase_id
                VALUES (@purchase_date, @total_amount, @purchase_type, @notes, @created_by)
            `);

        const purchaseId = headerResult.recordset[0].purchase_id;
        console.log('📋 Purchase header created with ID:', purchaseId);

        // Insert purchase items
        for (const item of items) {
            await new sql.Request(transaction)
                .input('purchase_id', sql.Int, purchaseId)
                .input('product_id', sql.Int, item.product_id)
                .input('quantity', sql.Decimal, item.quantity)
                .input('unit_price', sql.Decimal, item.unit_price)
                .input('total_price', sql.Decimal, item.quantity * item.unit_price)
                .query(`
                    INSERT INTO stock_purchase_items 
                    (purchase_id, product_id, quantity, unit_price, total_price)
                    VALUES (@purchase_id, @product_id, @quantity, @unit_price, @total_price)
                `);
            
            console.log('📦 Item tracked - Product:', item.product_id, 'Qty:', item.quantity);
        }

        await transaction.commit();
        console.log('✅ Purchase tracking committed successfully');

    } catch (error) {
        await transaction.rollback();
        console.error('❌ Purchase tracking failed and rolled back:', error);
        throw error;
    }
}

module.exports = ProductController;
