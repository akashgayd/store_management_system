const { getPool, sql } = require('../config/db');
const { responseHelper } = require('../utils/responseHelper');

class PurchaseReportController {

    // Get purchase report by date range
    static async getPurchaseReport(req, res) {
        try {
            const { startDate, endDate, date } = req.query;

            let finalStartDate, finalEndDate;

            if (date) {
                // Single date query
                finalStartDate = finalEndDate = date;
            } else if (startDate && endDate) {
                // Date range query
                finalStartDate = startDate;
                finalEndDate = endDate;
            } else {
                return responseHelper.error(res, 'Either "date" or both "startDate" and "endDate" are required', 400);
            }

            // Validate dates
            const start = new Date(finalStartDate);
            const end = new Date(finalEndDate);
            
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return responseHelper.error(res, 'Invalid date format. Use YYYY-MM-DD', 400);
            }

            if (start > end) {
                return responseHelper.error(res, 'startDate cannot be later than endDate', 400);
            }

            // ✅ FIX: Use class name instead of 'this'
            const reportData = await PurchaseReportController.generatePurchaseReport(finalStartDate, finalEndDate);

            return responseHelper.success(res, 'Purchase report generated', {
                period: { startDate: finalStartDate, endDate: finalEndDate },
                ...reportData
            });

        } catch (error) {
            console.error('Purchase Report Error:', error);
            return responseHelper.error(res, error.message, 500);
        }
    }

    static async generatePurchaseReport(startDate, endDate) {
        const pool = getPool();

        try {
            // Summary query
            const summaryResult = await pool.request()
                .input('start_date', sql.Date, startDate)
                .input('end_date', sql.Date, endDate)
                .query(`
                    SELECT 
                        COUNT(DISTINCT sp.purchase_id) AS total_purchases,
                        COUNT(spi.purchase_item_id) AS total_items,
                        SUM(spi.quantity) AS total_quantity,
                        SUM(sp.total_amount) AS total_amount,
                        AVG(sp.total_amount) AS avg_purchase_amount
                    FROM stock_purchases sp
                    LEFT JOIN stock_purchase_items spi ON sp.purchase_id = spi.purchase_id
                    WHERE sp.purchase_date BETWEEN @start_date AND @end_date
                `);

            // Daily breakdown
            const dailyResult = await pool.request()
                .input('start_date', sql.Date, startDate)
                .input('end_date', sql.Date, endDate)
                .query(`
                    SELECT sp.purchase_date,
                           COUNT(DISTINCT sp.purchase_id) AS purchases_count,
                           SUM(sp.total_amount) AS day_total,
                           sp.purchase_type
                    FROM stock_purchases sp
                    WHERE sp.purchase_date BETWEEN @start_date AND @end_date
                    GROUP BY sp.purchase_date, sp.purchase_type
                    ORDER BY sp.purchase_date DESC
                `);

            // Product breakdown
            const productResult = await pool.request()
                .input('start_date', sql.Date, startDate)
                .input('end_date', sql.Date, endDate)
                .query(`
                    SELECT p.name AS product_name, p.category, p.unit,
                           SUM(spi.quantity) AS total_quantity_purchased,
                           AVG(spi.unit_price) AS avg_unit_price,
                           SUM(spi.total_price) AS total_spent
                    FROM stock_purchases sp
                    JOIN stock_purchase_items spi ON sp.purchase_id = spi.purchase_id
                    JOIN products p ON spi.product_id = p.product_id
                    WHERE sp.purchase_date BETWEEN @start_date AND @end_date
                    GROUP BY p.product_id, p.name, p.category, p.unit
                    ORDER BY total_spent DESC
                `);

            // Detailed purchases
            const detailResult = await pool.request()
                .input('start_date', sql.Date, startDate)
                .input('end_date', sql.Date, endDate)
                .query(`
                    SELECT sp.purchase_id, sp.purchase_date, sp.total_amount, sp.purchase_type, sp.notes,
                           p.name AS product_name, p.category, p.unit,
                           spi.quantity, spi.unit_price, spi.total_price
                    FROM stock_purchases sp
                    JOIN stock_purchase_items spi ON sp.purchase_id = spi.purchase_id
                    JOIN products p ON spi.product_id = p.product_id
                    WHERE sp.purchase_date BETWEEN @start_date AND @end_date
                    ORDER BY sp.purchase_date DESC, sp.purchase_id DESC
                `);

            return {
                summary: summaryResult.recordset[0] || {
                    total_purchases: 0,
                    total_items: 0,
                    total_quantity: 0,
                    total_amount: 0,
                    avg_purchase_amount: 0
                },
                dailyBreakdown: dailyResult.recordset,
                productBreakdown: productResult.recordset,
                details: detailResult.recordset
            };

        } catch (error) {
            console.error('Generate Purchase Report Error:', error);
            throw error;
        }
    }
}

module.exports = PurchaseReportController;
