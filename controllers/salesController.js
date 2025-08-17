const SalesModel = require('../models/salesModel');
const ExcelService = require('../services/excelService');
const { responseHelper } = require('../utils/responseHelper');

class SalesController {

  // ✅ ENHANCED: Create sale with multiple products
  static async addSale(req, res) {
    try {
      const { items, sale_date, notes } = req.body;

      // Validate items array
      if (!items || !Array.isArray(items) || items.length === 0) {
        return responseHelper.error(res, 'Items array is required and cannot be empty', 400);
      }

      // Validate each item
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.product_id || !item.quantity) {
          return responseHelper.error(res, `Item ${i + 1}: product_id and quantity are required`, 400);
        }
        if (item.quantity <= 0) {
          return responseHelper.error(res, `Item ${i + 1}: quantity must be greater than 0`, 400);
        }
      }

      const sale = await SalesModel.createSale(items, sale_date);

      return responseHelper.success(res, 'Sale recorded successfully', {
        ...sale,
        notes: notes || null
      }, 201);

    } catch (error) {
      console.error('Add Sale Error:', error);
      return responseHelper.error(res, error.message, 500);
    }
  }

  // ✅ NEW: Excel bulk sales upload
  static async uploadSalesExcel(req, res) {
    try {
      if (!req.file) {
        return responseHelper.error(res, 'Excel file is required', 400);
      }

      const result = await ExcelService.processSalesExcelUpload(req.file.path);

      if (result.success) {
        return responseHelper.success(res, result.message, {
          sales: result.data.successful,
          failed: result.data.failed,
          summary: result.data.summary
        }, 201);
      } else {
        return responseHelper.error(res, result.message, 400, result.errors);
      }

    } catch (error) {
      console.error('Sales Excel Upload Error:', error);
      return responseHelper.error(res, error.message, 500);
    }
  }

  // ✅ EXISTING: Keep existing methods
  static async getDailySales(req, res) {
    try {
      const { date } = req.query;
      const targetDate = date || new Date().toISOString().slice(0, 10);
      
      const sales = await SalesModel.getSalesByDate(targetDate);
      
      return responseHelper.success(res, `Sales for ${targetDate}`, {
        date: targetDate,
        sales,
        total_items: sales.length,
        total_revenue: sales.reduce((sum, sale) => sum + Number(sale.line_total), 0)
      });

    } catch (error) {
      console.error('Get Daily Sales Error:', error);
      return responseHelper.error(res, error.message, 500);
    }
  }

  static async getSalesReport(req, res) {
    try {
      const { startDate, endDate } = req.query || {};

      if (!startDate || !endDate) {
        return responseHelper.error(res, 'startDate and endDate query params are required (YYYY-MM-DD)', 400);
      }

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
