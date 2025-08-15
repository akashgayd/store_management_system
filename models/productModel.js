const { getPool, sql } = require('../config/db');

class ProductModel {
    
    // Add single product
    static async addProduct(productData) {
        try {
            const pool = getPool();
            const request = pool.request();
            
            const query = `
                INSERT INTO products (name, category, unit, quantity, price, expiry_date, reorder_level, supplier_id)
                OUTPUT INSERTED.*
                VALUES (@name, @category, @unit, @quantity, @price, @expiry_date, @reorder_level, @supplier_id)
            `;
            
            request.input('name', sql.VarChar, productData.name);
            request.input('category', sql.VarChar, productData.category);
            request.input('unit', sql.VarChar, productData.unit);
            request.input('quantity', sql.Decimal, productData.quantity);
            request.input('price', sql.Decimal, productData.price || null);
            request.input('expiry_date', sql.Date, productData.expiry_date || null);
            request.input('reorder_level', sql.Int, productData.reorder_level || 10);
            request.input('supplier_id', sql.Int, productData.supplier_id || null);
            
            const result = await request.query(query);
            return result.recordset[0];
            
        } catch (error) {
            throw new Error(`Database error: ${error.message}`);
        }
    }
    
    // Add multiple products (bulk insert)
    static async addBulkProducts(productsArray) {
        try {
            const pool = getPool();
            const transaction = new sql.Transaction(pool);
            
            await transaction.begin();
            
            const results = [];
            const errors = [];
            
            for (let i = 0; i < productsArray.length; i++) {
                try {
                    const request = new sql.Request(transaction);
                    const product = productsArray[i];
                    
                    const query = `
                        INSERT INTO products (name, category, unit, quantity, price, expiry_date, reorder_level, supplier_id)
                        OUTPUT INSERTED.*
                        VALUES (@name, @category, @unit, @quantity, @price, @expiry_date, @reorder_level, @supplier_id)
                    `;
                    
                    request.input('name', sql.VarChar, product.name);
                    request.input('category', sql.VarChar, product.category);
                    request.input('unit', sql.VarChar, product.unit);
                    request.input('quantity', sql.Decimal, product.quantity);
                    request.input('price', sql.Decimal, product.price || null);
                    request.input('expiry_date', sql.Date, product.expiry_date || null);
                    request.input('reorder_level', sql.Int, product.reorder_level || 10);
                    request.input('supplier_id', sql.Int, product.supplier_id || null);
                    
                    const result = await request.query(query);
                    results.push(result.recordset[0]);
                    
                } catch (error) {
                    errors.push({
                        row: i + 1,
                        error: error.message,
                        data: productsArray[i]
                    });
                }
            }
            
            await transaction.commit();
            
            return { 
                successful: results, 
                failed: errors,
                totalProcessed: productsArray.length,
                successCount: results.length,
                errorCount: errors.length
            };
            
        } catch (error) {
            throw new Error(`Bulk insert error: ${error.message}`);
        }
    }
    
    // Check if product exists by name
    static async findByName(name) {
        try {
            const pool = getPool();
            const request = pool.request();
            
            request.input('name', sql.VarChar, name);
            const result = await request.query('SELECT * FROM products WHERE name = @name');
            
            return result.recordset[0] || null;
            
        } catch (error) {
            throw new Error(`Database error: ${error.message}`);
        }
    }
}

module.exports = ProductModel;
