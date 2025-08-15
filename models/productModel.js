const { getPool, sql } = require('../config/db');

class ProductModel {
    
    // Find product by name
    static async findByName(name) {
        try {
            const pool = getPool();
            const request = pool.request();

            request.input('name', sql.VarChar, name);

            const result = await request.query(`
                SELECT TOP 1 * 
                FROM products 
                WHERE name = @name
            `);

            return result.recordset[0] || null;
        } catch (error) {
            throw new Error(`Database error in findByName: ${error.message}`);
        }
    }

    // Add single product
    static async addProduct(productData) {
        try {
            const pool = getPool();
            const request = pool.request();
            const query = `
MERGE products AS target
USING (VALUES (@name, @category, @unit, @quantity, @price, @expiry_date, @reorder_level, @supplier_id)) 
       AS source (name, category, unit, quantity, price, expiry_date, reorder_level, supplier_id)
ON target.name = source.name AND target.category = source.category AND target.unit = source.unit
WHEN MATCHED THEN
    UPDATE SET 
        target.quantity = target.quantity + source.quantity,  -- only add quantity
        target.price = source.price,                          -- replace price
        target.expiry_date = source.expiry_date,
        target.reorder_level = source.reorder_level,
        target.supplier_id = source.supplier_id
WHEN NOT MATCHED THEN
    INSERT (name, category, unit, quantity, price, expiry_date, reorder_level, supplier_id)
    VALUES (source.name, source.category, source.unit, source.quantity, source.price, source.expiry_date, source.reorder_level, source.supplier_id)
OUTPUT INSERTED.*;
            `;
            
            request.input('product_id', sql.Int, productData.product_id || null);
            request.input('name', sql.VarChar, productData.name);
            request.input('category', sql.VarChar, productData.category);
            request.input('unit', sql.VarChar, productData.unit);
            request.input('quantity', sql.Decimal(10, 2), productData.quantity);
            request.input('price', sql.Decimal(10, 2), productData.price || null);
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
MERGE products AS target
USING (VALUES (@name, @category, @unit, @quantity, @price, @expiry_date, @reorder_level, @supplier_id)) 
       AS source (name, category, unit, quantity, price, expiry_date, reorder_level, supplier_id)
ON target.name = source.name AND target.category = source.category AND target.unit = source.unit
WHEN MATCHED THEN
    UPDATE SET 
        target.quantity = target.quantity + source.quantity,  -- only add quantity
        target.price = source.price,                          -- replace price
        target.expiry_date = source.expiry_date,
        target.reorder_level = source.reorder_level,
        target.supplier_id = source.supplier_id
WHEN NOT MATCHED THEN
    INSERT (name, category, unit, quantity, price, expiry_date, reorder_level, supplier_id)
    VALUES (source.name, source.category, source.unit, source.quantity, source.price, source.expiry_date, source.reorder_level, source.supplier_id)
OUTPUT INSERTED.*;
                    `;
                    
                    request.input('product_id', sql.Int, product.product_id || null);
                    request.input('name', sql.VarChar, product.name);
                    request.input('category', sql.VarChar, product.category);
                    request.input('unit', sql.VarChar, product.unit);
                    request.input('quantity', sql.Decimal(10, 2), product.quantity);
                    request.input('price', sql.Decimal(10, 2), product.price || null);
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
    
    // Check if product exists by product_id
    static async findByProductId(product_id) {
        try {
            const pool = getPool();
            const request = pool.request();
            
            request.input('product_id', sql.Int, product_id);
            const result = await request.query('SELECT * FROM products WHERE product_id = @product_id');
            
            return result.recordset[0] || null;
            
        } catch (error) {
            throw new Error(`Database error: ${error.message}`);
        }
    }






  /* …existing addProduct, addBulkProducts, findByName … */

  // 🔹 Get list with optional filters & pagination
  static async getProducts({ search, category, page = 1, limit = 20 }) {
    const pool = getPool();
    const offset = (page - 1) * limit;

    let baseQuery = `
      SELECT * FROM products WHERE 1 = 1
        ${search   ? 'AND name LIKE @search'      : ''}
        ${category ? 'AND category = @category'   : ''}
      ORDER BY product_id DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
    `;

    const request = pool.request();
    if (search)   request.input('search',   sql.VarChar, `%${search}%`);
    if (category) request.input('category', sql.VarChar,  category);
    request.input('offset', sql.Int, offset);
    request.input('limit',  sql.Int, limit);

    const result = await request.query(baseQuery);
    return result.recordset;
  }

  // 🔹 Get single product by primary key
  static async getProductById(id) {
    const pool = getPool();
    const request = pool.request();
    request.input('id', sql.Int, id);

    const result = await request.query(
      'SELECT * FROM products WHERE product_id = @id'
    );
    return result.recordset[0] || null;
  }


  /* ---------- UPDATE product by id ---------- */
static async updateProduct(id, data) {
  const pool = getPool();

  /* Build SET clause dynamically */
  const allowed = [
    'name','category','unit','quantity',
    'price','expiry_date','reorder_level','supplier_id'
  ];
  const keys   = Object.keys(data).filter(k => allowed.includes(k));
  if (keys.length === 0) throw new Error('No valid fields to update');

  const setClauses = keys.map((k, i) => `${k} = @v${i}`).join(', ');
  const request    = pool.request().input('id', sql.Int, id);

  keys.forEach((k, i) => {
    request.input(`v${i}`, data[k] === '' ? null : data[k]);
  });

  const result = await request.query(`
    UPDATE products SET ${setClauses}
    OUTPUT INSERTED.*
    WHERE product_id = @id
  `);

  return result.recordset[0] || null;
}

}

module.exports = ProductModel;
