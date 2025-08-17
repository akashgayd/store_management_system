const { getPool, sql } = require('../config/db');

class SalesModel {

  // ✅ ENHANCED: Create sale with multiple items
  static async createSale(items, saleDate = null) {
    const pool = getPool();
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      // Validate items array
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('Items array is required and cannot be empty');
      }

      // Calculate grand total and validate products
      let grandTotal = 0;
      const validatedItems = [];

      for (const item of items) {
        // Get product details and check stock
        const productResult = await new sql.Request(transaction)
          .input('product_id', sql.Int, item.product_id)
          .query('SELECT product_id, name, price, quantity FROM products WHERE product_id = @product_id');

        if (productResult.recordset.length === 0) {
          throw new Error(`Product with ID ${item.product_id} not found`);
        }

        const product = productResult.recordset[0];
        
        // Check if sufficient stock
        if (product.quantity < item.quantity) {
          throw new Error(`Insufficient stock for ${product.name}. Available: ${product.quantity}, Requested: ${item.quantity}`);
        }

        const lineTotal = product.price * item.quantity;
        grandTotal += lineTotal;

        validatedItems.push({
          product_id: item.product_id,
          product_name: product.name,
          quantity: item.quantity,
          unit_price: product.price,
          line_total: lineTotal
        });
      }

      // Insert sales order header
      const orderDate = saleDate || new Date();
      const headerResult = await new sql.Request(transaction)
        .input('order_date', sql.DateTime, orderDate)
        .input('total_amount', sql.Decimal, grandTotal)
        .query(`
          INSERT INTO sales_orders (order_date, total_amount)
          OUTPUT INSERTED.order_id, INSERTED.order_date, INSERTED.total_amount
          VALUES (@order_date, @total_amount)
        `);

      const orderId = headerResult.recordset[0].order_id;

      // Insert sales items and update product quantities
      for (const item of validatedItems) {
        // Insert sale item
        await new sql.Request(transaction)
          .input('order_id', sql.Int, orderId)
          .input('product_id', sql.Int, item.product_id)
          .input('quantity', sql.Decimal, item.quantity)
          .input('unit_price', sql.Decimal, item.unit_price)
          .input('line_total', sql.Decimal, item.line_total)
          .query(`
            INSERT INTO sales_items (order_id, product_id, quantity, unit_price, line_total)
            VALUES (@order_id, @product_id, @quantity, @unit_price, @line_total)
          `);

        // Update product quantity
        await new sql.Request(transaction)
          .input('product_id', sql.Int, item.product_id)
          .input('quantity', sql.Decimal, item.quantity)
          .query('UPDATE products SET quantity = quantity - @quantity WHERE product_id = @product_id');
      }

      await transaction.commit();
      
      return {
        order_id: orderId,
        order_date: headerResult.recordset[0].order_date,
        total_amount: headerResult.recordset.total_amount,
        items: validatedItems,
        item_count: validatedItems.length
      };

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // ✅ NEW: Bulk sales from Excel data
  static async createBulkSales(salesData) {
    const results = {
      successful: [],
      failed: [],
      summary: {
        total_attempted: salesData.length,
        total_successful: 0,
        total_failed: 0,
        total_revenue: 0
      }
    };

    for (const saleData of salesData) {
      try {
        const { sale_date, items, notes } = saleData;
        
        const sale = await this.createSale(items, sale_date);
        
        results.successful.push({
          sale_date,
          order_id: sale.order_id,
          total_amount: sale.total_amount,
          item_count: sale.item_count,
          notes: notes || null
        });

        results.summary.total_successful++;
        results.summary.total_revenue += sale.total_amount;

      } catch (error) {
        results.failed.push({
          sale_data: saleData,
          error: error.message
        });
        results.summary.total_failed++;
      }
    }

    return results;
  }

  // ✅ EXISTING: Keep all existing methods
  static async getSalesByDate(date) {
    const pool = getPool();
    
    const result = await pool.request()
      .input('sale_date', sql.Date, date)
      .query(`
        SELECT so.order_id, so.order_date, so.total_amount,
               si.quantity, si.unit_price, si.line_total,
               p.name, p.category, p.unit
        FROM sales_orders so
        JOIN sales_items si ON so.order_id = si.order_id
        JOIN products p ON si.product_id = p.product_id
        WHERE CAST(so.order_date AS DATE) = @sale_date
        ORDER BY so.order_date DESC
      `);

    return result.recordset;
  }

  static async getSalesReport(startDate, endDate) {
    const pool = getPool();
    
    // Summary query
    const summaryResult = await pool.request()
      .input('startDate', sql.Date, startDate)
      .input('endDate', sql.Date, endDate)
      .query(`
        SELECT COUNT(DISTINCT so.order_id) AS total_orders,
               COUNT(si.order_item_id) AS total_items_sold,
               SUM(si.quantity) AS total_quantity,
               SUM(so.total_amount) AS total_revenue,
               AVG(so.total_amount) AS avg_order_value
        FROM sales_orders so
        JOIN sales_items si ON si.order_id = so.order_id
        WHERE CAST(so.order_date AS DATE) BETWEEN @startDate AND @endDate
      `);

    // Product breakdown
    const productResult = await pool.request()
      .input('startDate', sql.Date, startDate)
      .input('endDate', sql.Date, endDate)
      .query(`
        SELECT p.name AS product_name, p.category, p.unit,
               SUM(si.quantity) AS total_quantity_sold,
               AVG(si.unit_price) AS avg_unit_price,
               SUM(si.line_total) AS total_revenue
        FROM sales_orders so
        JOIN sales_items si ON si.order_id = so.order_id
        JOIN products p ON p.product_id = si.product_id
        WHERE CAST(so.order_date AS DATE) BETWEEN @startDate AND @endDate
        GROUP BY p.product_id, p.name, p.category, p.unit
        ORDER BY total_revenue DESC
      `);

    // Daily breakdown
    const dailyResult = await pool.request()
      .input('startDate', sql.Date, startDate)
      .input('endDate', sql.Date, endDate)
      .query(`
        SELECT CAST(so.order_date AS DATE) AS sale_date,
               COUNT(DISTINCT so.order_id) AS orders_count,
               SUM(so.total_amount) AS day_revenue
        FROM sales_orders so
        WHERE CAST(so.order_date AS DATE) BETWEEN @startDate AND @endDate
        GROUP BY CAST(so.order_date AS DATE)
        ORDER BY sale_date DESC
      `);

    return {
      summary: summaryResult.recordset[0] || {},
      productBreakdown: productResult.recordset,
      dailyBreakdown: dailyResult.recordset
    };
  }
}

module.exports = SalesModel;
