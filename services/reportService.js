const SalesModel = require('../models/salesModel');
const ProductModel = require('../models/productModel');

class ReportService {
  
  // Generate different types of reports
  static async generateReport(type, options = {}) {
    switch (type) {
      case 'daily':
        return await this.dailyReport(options.date || new Date().toISOString().slice(0,10));
      case 'weekly':
        return await this.weeklyReport(options.startDate, options.endDate);
      case 'monthly':
        return await this.monthlyReport(options.month, options.year);
      case 'custom':
        return await this.customReport(options.startDate, options.endDate);
      default:
        throw new Error('Invalid report type');
    }
  }

  static async dailyReport(date) {
    const salesData = await SalesModel.getSalesByDate(date);
    const stockData = await ProductModel.getProducts({});
    
    return {
      type: 'daily',
      date,
      data: { salesData, stockData },
      html: this.createResponsiveReportHtml('daily', { salesData, stockData, date })
    };
  }

  static async weeklyReport(startDate, endDate) {
    const reportData = await SalesModel.getSalesReport(startDate, endDate);
    
    return {
      type: 'weekly',
      period: { startDate, endDate },
      data: reportData,
      html: this.createResponsiveReportHtml('weekly', { ...reportData, startDate, endDate })
    };
  }

  static async monthlyReport(month, year) {
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().slice(0, 10);
    const reportData = await SalesModel.getSalesReport(startDate, endDate);
    
    return {
      type: 'monthly',
      period: { month, year, startDate, endDate },
      data: reportData,
      html: this.createResponsiveReportHtml('monthly', { ...reportData, month, year, startDate, endDate })
    };
  }

  static async customReport(startDate, endDate) {
    const reportData = await SalesModel.getSalesReport(startDate, endDate);
    
    return {
      type: 'custom',
      period: { startDate, endDate },
      data: reportData,
      html: this.createResponsiveReportHtml('custom', { ...reportData, startDate, endDate })
    };
  }

  // Responsive email template
  static createResponsiveReportHtml(type, data) {
    const styles = `
      <style>
        @media only screen and (max-width: 600px) {
          .container { width: 100% !important; padding: 10px !important; }
          .header { padding: 20px !important; font-size: 24px !important; }
          .summary-card { width: 100% !important; margin-bottom: 15px !important; }
          .table-responsive { overflow-x: auto; }
          table { font-size: 12px !important; }
          .hide-mobile { display: none !important; }
        }
        @media only screen and (max-width: 480px) {
          .header h1 { font-size: 20px !important; }
          .summary-card h3 { font-size: 14px !important; }
          .summary-card p { font-size: 18px !important; }
        }
      </style>
    `;

    switch (type) {
      case 'daily':
        return this.dailyReportTemplate(data, styles);
      case 'weekly':
      case 'monthly':
      case 'custom':
        return this.periodReportTemplate(data, styles, type);
      default:
        return '<p>Invalid report type</p>';
    }
  }

  static dailyReportTemplate(data, styles) {
    const { salesData, stockData, date } = data;
    const formattedDate = new Date(date).toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const totalRevenue = salesData.reduce((sum, sale) => sum + Number(sale.line_total), 0);
    const totalOrders = [...new Set(salesData.map(sale => sale.order_id))].length;
    const totalItems = salesData.reduce((sum, sale) => sum + Number(sale.quantity), 0);

    let salesRows = '';
    if (salesData.length > 0) {
      salesData.forEach(sale => {
        salesRows += `
          <tr style="border-bottom: 1px solid #e9ecef;">
            <td style="padding: 8px; border-right: 1px solid #e9ecef;">${sale.name}</td>
            <td style="padding: 8px; border-right: 1px solid #e9ecef; text-align: center;">${sale.quantity}</td>
            <td style="padding: 8px; border-right: 1px solid #e9ecef; text-align: right;" class="hide-mobile">₹${Number(sale.unit_price).toFixed(2)}</td>
            <td style="padding: 8px; text-align: right; font-weight: bold;">₹${Number(sale.line_total).toFixed(2)}</td>
          </tr>
        `;
      });
    } else {
      salesRows = `<tr><td colspan="4" style="padding: 20px; text-align: center; color: #666;">No sales recorded today</td></tr>`;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Daily Sales Report</title>
        ${styles}
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh;">
        <div class="container" style="max-width: 800px; margin: 0 auto; background: white; min-height: 100vh;">
          
          <!-- Header -->
          <div class="header" style="background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); color: white; padding: 30px; text-align: center; position: relative; overflow: hidden;">
            <div style="position: absolute; top: -50px; right: -50px; width: 100px; height: 100px; background: rgba(255,255,255,0.1); border-radius: 50%; opacity: 0.7;"></div>
            <div style="position: absolute; bottom: -30px; left: -30px; width: 60px; height: 60px; background: rgba(255,255,255,0.1); border-radius: 50%; opacity: 0.5;"></div>
            <h1 style="margin: 0; font-size: 28px; font-weight: 300; letter-spacing: 1px;">📊 Daily Sales Report</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">${formattedDate}</p>
          </div>

          <!-- Summary Cards -->
          <div style="padding: 30px; background: #f8f9fa;">
            <div style="display: flex; flex-wrap: wrap; justify-content: space-between; gap: 15px;">
              <div class="summary-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; text-align: center; flex: 1; min-width: 200px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                <h3 style="margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8;">Total Revenue</h3>
                <p style="font-size: 24px; font-weight: bold; margin: 0;">₹${totalRevenue.toFixed(2)}</p>
              </div>
              <div class="summary-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; border-radius: 12px; text-align: center; flex: 1; min-width: 200px; box-shadow: 0 4px 15px rgba(240, 147, 251, 0.4);">
                <h3 style="margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8;">Total Orders</h3>
                <p style="font-size: 24px; font-weight: bold; margin: 0;">${totalOrders}</p>
              </div>
              <div class="summary-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 20px; border-radius: 12px; text-align: center; flex: 1; min-width: 200px; box-shadow: 0 4px 15px rgba(79, 172, 254, 0.4);">
                <h3 style="margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8;">Items Sold</h3>
                <p style="font-size: 24px; font-weight: bold; margin: 0;">${totalItems}</p>
              </div>
            </div>
          </div>

          <!-- Sales Table -->
          <div style="padding: 30px;">
            <h3 style="color: #2c3e50; margin-bottom: 20px; font-size: 20px; border-bottom: 2px solid #3498db; padding-bottom: 10px;">💰 Sales Breakdown</h3>
            <div class="table-responsive" style="overflow-x: auto; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <table style="width: 100%; border-collapse: collapse; background: white;">
                <thead>
                  <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                    <th style="padding: 15px; text-align: left; font-weight: 500;">Product</th>
                    <th style="padding: 15px; text-align: center; font-weight: 500;">Qty</th>
                    <th style="padding: 15px; text-align: right; font-weight: 500;" class="hide-mobile">Unit Price</th>
                    <th style="padding: 15px; text-align: right; font-weight: 500;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${salesRows}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Footer -->
          <div style="background: #2c3e50; color: white; padding: 20px; text-align: center;">
            <p style="margin: 0; font-size: 14px; opacity: 0.8;">
              📧 Generated automatically by Restaurant Management System<br>
              ${new Date().toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  static periodReportTemplate(data, styles, type) {
    const { summary, productBreakdown, dailyBreakdown, startDate, endDate } = data;
    
    const typeLabels = {
      weekly: '📅 Weekly Report',
      monthly: '📅 Monthly Report', 
      custom: '📅 Custom Report'
    };

    const periodText = type === 'monthly' 
      ? `${new Date(startDate).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`
      : `${new Date(startDate).toLocaleDateString('en-IN')} - ${new Date(endDate).toLocaleDateString('en-IN')}`;

    let productRows = '';
    productBreakdown.slice(0, 10).forEach(product => {
      productRows += `
        <tr style="border-bottom: 1px solid #e9ecef;">
          <td style="padding: 10px; border-right: 1px solid #e9ecef;">${product.product_name}</td>
          <td style="padding: 10px; border-right: 1px solid #e9ecef; text-align: center;">${Number(product.total_quantity_sold).toFixed(1)}</td>
          <td style="padding: 10px; border-right: 1px solid #e9ecef; text-align: right;" class="hide-mobile">₹${Number(product.avg_unit_price).toFixed(2)}</td>
          <td style="padding: 10px; text-align: right; font-weight: bold;">₹${Number(product.total_revenue).toFixed(2)}</td>
        </tr>
      `;
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${typeLabels[type]}</title>
        ${styles}
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh;">
        <div class="container" style="max-width: 900px; margin: 0 auto; background: white; min-height: 100vh;">
          
          <!-- Header -->
          <div class="header" style="background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 300;">${typeLabels[type]}</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">${periodText}</p>
          </div>

          <!-- Summary Cards -->
          <div style="padding: 30px; background: #f8f9fa;">
            <div style="display: flex; flex-wrap: wrap; justify-content: space-between; gap: 15px;">
              <div class="summary-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; text-align: center; flex: 1; min-width: 180px;">
                <h3 style="margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; opacity: 0.8;">Total Revenue</h3>
                <p style="font-size: 22px; font-weight: bold; margin: 0;">₹${Number(summary.total_revenue || 0).toFixed(2)}</p>
              </div>
              <div class="summary-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; border-radius: 12px; text-align: center; flex: 1; min-width: 180px;">
                <h3 style="margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; opacity: 0.8;">Total Orders</h3>
                <p style="font-size: 22px; font-weight: bold; margin: 0;">${summary.total_orders || 0}</p>
              </div>
              <div class="summary-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 20px; border-radius: 12px; text-align: center; flex: 1; min-width: 180px;">
                <h3 style="margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; opacity: 0.8;">Avg Order</h3>
                <p style="font-size: 22px; font-weight: bold; margin: 0;">₹${Number(summary.avg_order_value || 0).toFixed(2)}</p>
              </div>
            </div>
          </div>

          <!-- Product Performance -->
          <div style="padding: 30px;">
            <h3 style="color: #2c3e50; margin-bottom: 20px; font-size: 20px;">🏆 Top Performing Products</h3>
            <div class="table-responsive" style="overflow-x: auto; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <table style="width: 100%; border-collapse: collapse; background: white;">
                <thead>
                  <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                    <th style="padding: 15px; text-align: left;">Product</th>
                    <th style="padding: 15px; text-align: center;">Qty Sold</th>
                    <th style="padding: 15px; text-align: right;" class="hide-mobile">Avg Price</th>
                    <th style="padding: 15px; text-align: right;">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  ${productRows}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Footer -->
          <div style="background: #2c3e50; color: white; padding: 20px; text-align: center;">
            <p style="margin: 0; font-size: 14px; opacity: 0.8;">
              📧 Generated by Restaurant Management System • ${new Date().toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = ReportService;
