const { getPool, sql } = require('../config/db');

class SalesModel {

  /* ----  create a complete sale in ONE transaction  ---- */
  static async createSale(items) {
    const pool = getPool();
    const trx  = new sql.Transaction(pool);

    try {
      await trx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE); // safest for stock
      
      /* 1. Build detail rows with live prices & check stock */
      const detail = [];
      let   grand  = 0;

      for (const { product_id, quantity } of items) {
        const r = await new sql.Request(trx)
          .input('pid', sql.Int, product_id)
          .query('SELECT quantity AS stock, price FROM products WHERE product_id = @pid');

        if (r.recordset.length === 0) {
          throw new Error(`Product ${product_id} not found`);
        }
        const { stock, price } = r.recordset[0];
        if (stock < quantity) {
          throw new Error(`Insufficient stock for product ${product_id}`);
        }

        /* Push detail   */
        const lineTotal = price * quantity;
        grand += lineTotal;

        detail.push({ product_id, quantity, price, lineTotal });

        /* Deduct stock  */
        await new sql.Request(trx)
          .input('qty', sql.Decimal, quantity)
          .input('pid', sql.Int,     product_id)
          .query('UPDATE products SET quantity = quantity - @qty WHERE product_id = @pid');
      }

      /* 2. Insert header */
      const hdrRes = await new sql.Request(trx)
        .input('total', sql.Decimal, grand)
        .query(`
          INSERT INTO sales_orders (total_amount)
          OUTPUT INSERTED.order_id, INSERTED.order_date, INSERTED.total_amount
          VALUES (@total);
        `);
      const order = hdrRes.recordset[0];

      /* 3. Insert detail rows */
      for (const row of detail) {
        await new sql.Request(trx)
          .input('oid', sql.Int,      order.order_id)
          .input('pid', sql.Int,      row.product_id)
          .input('qty', sql.Decimal,  row.quantity)
          .input('price', sql.Decimal,row.price)
          .input('total', sql.Decimal,row.lineTotal)
          .query(`
            INSERT INTO sales_items (order_id, product_id, quantity, unit_price, line_total)
            VALUES (@oid, @pid, @qty, @price, @total);
          `);
      }

      await trx.commit();
      return { order, items: detail };

    } catch (err) {
      await trx.rollback();
      throw err;
    }
  }

  /* ----  get sales for a specific day  ---- */
  static async getSalesByDate(dateStr) {
    const pool = getPool();
    const request = pool.request()
      .input('theDay', sql.Date, dateStr);      // date type, not datetime

    /* use CAST(date) for reliable comparison */
    const result = await request.query(`
      SELECT so.order_id, so.order_date, so.total_amount,
             si.product_id, p.name, si.quantity, si.unit_price, si.line_total
      FROM   sales_orders so
      JOIN   sales_items  si ON si.order_id  = so.order_id
      JOIN   products     p  ON p.product_id = si.product_id
      WHERE  CAST(so.order_date AS DATE) = @theDay      -- <── revised
      ORDER  BY so.order_id;
    `);
    return result.recordset;
  }

  // ✅ CLEAN: No responseHelper in models
  static async getSalesReport(startDate, endDate) {
    try {
      const pool = getPool();
      const request = pool.request()
        .input('startDate', sql.Date, startDate)
        .input('endDate', sql.Date, endDate);

      // Product breakdown query
      const detailQuery = `
        SELECT p.name AS product_name,
               p.category,
               p.unit,
               SUM(si.quantity) AS total_quantity_sold,
               AVG(si.unit_price) AS avg_unit_price,
               SUM(si.line_total) AS total_revenue
        FROM sales_orders so
        JOIN sales_items si ON si.order_id = so.order_id
        JOIN products p ON p.product_id = si.product_id
        WHERE CAST(so.order_date AS DATE) BETWEEN @startDate AND @endDate
        GROUP BY p.product_id, p.name, p.category, p.unit
        ORDER BY total_revenue DESC;
      `;

      // Summary totals query
      const summaryQuery = `
        SELECT COUNT(DISTINCT so.order_id) AS total_orders,
               COUNT(si.order_item_id) AS total_items_sold,
               SUM(si.quantity) AS total_quantity,
               SUM(so.total_amount) AS total_revenue,
               AVG(so.total_amount) AS avg_order_value
        FROM sales_orders so
        JOIN sales_items si ON si.order_id = so.order_id
        WHERE CAST(so.order_date AS DATE) BETWEEN @startDate AND @endDate;
      `;

      // Daily breakdown query
      const dailyQuery = `
        SELECT CAST(so.order_date AS DATE) AS sale_date,
               COUNT(DISTINCT so.order_id) AS orders_count,
               SUM(so.total_amount) AS day_revenue
        FROM sales_orders so
        WHERE CAST(so.order_date AS DATE) BETWEEN @startDate AND @endDate
        GROUP BY CAST(so.order_date AS DATE)
        ORDER BY sale_date;
      `;

      const [detailResult, summaryResult, dailyResult] = await Promise.all([
        request.query(detailQuery),
        request.query(summaryQuery),
        request.query(dailyQuery)
      ]);

      return {
        summary: summaryResult.recordset[0] || {
          total_orders: 0,
          total_items_sold: 0,
          total_quantity: 0,
          total_revenue: 0,
          avg_order_value: 0
        },
        productBreakdown: detailResult.recordset,
        dailyBreakdown: dailyResult.recordset
      };

    } catch (error) {
      throw error; // ✅ Let controller handle errors
    }
  }
}

module.exports = SalesModel;
