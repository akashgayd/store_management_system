const SalesModel = require('../models/salesModel');
const { responseHelper } = require('../utils/responseHelper');

class SalesController {

  /* -------- POST /api/sales -------- */
  static async addSale(req, res) {
    try {
      const { items } = req.body;
      const sale = await SalesModel.createSale(items);

      return responseHelper.success(res, 'Sale recorded', sale, 201);
    } catch (err) {
      console.error('Add Sale Error:', err);
      return responseHelper.error(res, err.message, 400);
    }
  }

  /* -------- GET /api/sales?date=YYYY-MM-DD -------- */
  static async getDailySales(req, res) {
    try {
      const date = req.query.date; // required
      if (!date) return responseHelper.error(res, 'date query param is required (YYYY-MM-DD)', 400);

      const rows = await SalesModel.getSalesByDate(date);

      /* Aggregate total of the day */
      const totalDay = rows.reduce((sum, r) => sum + Number(r.total_amount), 0);

      return responseHelper.success(res, 'Daily sales fetched', {
        date,
        totalDay,
        rows
      });
    } catch (err) {
      console.error('Get Sales Error:', err);
      return responseHelper.error(res, err.message, 500);
    }
  }


  // ✅ FIXED: GET /api/sales/report
  static async getSalesReport(req, res) {
    try {
      // ✅ Safe destructuring with fallback
      const { startDate, endDate } = req.query || {};

      if (!startDate || !endDate) {
        return responseHelper.error(res, 'startDate and endDate query params are required (YYYY-MM-DD)', 400);
      }

      // Validate date format
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return responseHelper.error(res, 'Invalid date format. Use YYYY-MM-DD', 400);
      }

      if (start > end) {
        return responseHelper.error(res, 'startDate cannot be later than endDate', 400);
      }

      const report = await SalesModel.getSalesReport(startDate, endDate);

      return responseHelper.success(res, 'Sales report generated', {
        period: { startDate, endDate },
        ...report
      });

    } catch (err) {
      console.error('Get Sales Report Error:', err);
      return responseHelper.error(res, err.message, 500);
    }
  }
}

module.exports = SalesController;

