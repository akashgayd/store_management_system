const AlertModel = require('../models/alertModel');
const { responseHelper } = require('../utils/responseHelper');
const { sendMail } = require('../services/emailService');

class AlertController {
  
  // ✅ EXISTING METHODS - Keep as is
  static async getRecipients(req, res) {
    const recipients = await AlertModel.getRecipients(false);
    return responseHelper.success(res, 'Recipients listed', recipients);
  }
  
  static async addRecipient(req, res) {
    const { email } = req.body;
    if (!email) return responseHelper.error(res, 'Email required', 400);
    const r = await AlertModel.addRecipient(email);
    return responseHelper.success(res, 'Recipient added', r);
  }
  
  static async sendReport(req, res) {
    const { recipient_id } = req.body;
    if (!recipient_id) return responseHelper.error(res, 'Recipient ID required', 400);
    // Logic to send report
    return responseHelper.success(res, 'Report sent', null);
  }

  static async testEmail(req, res) {
    try {
        console.log('🧪 Manual email test started');
        
        const result = await sendMail({
            to: 'poorneshmishra10@gmail.com',
            subject: 'Test Email from Restaurant API',
            html: '<h2>Hello!</h2><p>If you receive this, emails are working!</p>'
        });

        console.log('✅ Manual test email completed');
        return responseHelper.success(res, 'Test email sent successfully', { 
            messageId: result.messageId,
            response: result.response
        });

    } catch (error) {
        console.error('❌ Manual email test failed:', error);
        return responseHelper.error(res, `Email test failed: ${error.message}`, 500);
    }
  }

  // ✅ NEW METHODS - Add these to your existing controller
  static async getRecipientsWithSettings(req, res) {
    try {
      const recipients = await AlertModel.getAllRecipientsWithSettings();
      return responseHelper.success(res, 'Recipients with settings fetched', recipients);
    } catch (error) {
      console.error('Get Recipients Settings Error:', error);
      return responseHelper.error(res, error.message, 500);
    }
  }

  static async updateRecipientSettings(req, res) {
    try {
      const { id } = req.params;
      const settings = req.body;
      
      await AlertModel.updateRecipientSettings(id, settings);
      return responseHelper.success(res, 'Recipient settings updated');
    } catch (error) {
      console.error('Update Settings Error:', error);
      return responseHelper.error(res, error.message, 500);
    }
  }

  static async sendManualReport(req, res) {
    try {
      const { recipient_ids, report_type, options } = req.body;
      
      // Validate required fields
      if (!recipient_ids || !Array.isArray(recipient_ids) || recipient_ids.length === 0) {
        return responseHelper.error(res, 'recipient_ids array is required', 400);
      }
      if (!report_type) {
        return responseHelper.error(res, 'report_type is required (daily, weekly, monthly, custom)', 400);
      }

      // Get selected recipients (basic version without enhanced model)
      const allRecipients = await AlertModel.getRecipients(false);
      const selectedRecipients = allRecipients.filter(r => 
        recipient_ids.includes(r.recipient_id)
      );

      if (selectedRecipients.length === 0) {
        return responseHelper.error(res, 'No valid recipients found', 400);
      }

      // Generate report based on type
      let emailHtml = '';
      let subject = '';

      switch (report_type) {
        case 'daily':
          const date = options?.date || new Date().toISOString().slice(0,10);
          emailHtml = await generateDailyReportHtml(date);
          subject = `📊 Daily Sales Report - ${new Date(date).toLocaleDateString('en-IN')}`;
          break;
        
        case 'weekly':
        case 'monthly':
        case 'custom':
          if (!options?.startDate || !options?.endDate) {
            return responseHelper.error(res, 'startDate and endDate are required for this report type', 400);
          }
          emailHtml = await generatePeriodReportHtml(options.startDate, options.endDate, report_type);
          subject = `📊 ${report_type.charAt(0).toUpperCase() + report_type.slice(1)} Sales Report`;
          break;
        
        default:
          return responseHelper.error(res, 'Invalid report_type. Use: daily, weekly, monthly, custom', 400);
      }

      const sentEmails = [];
      const failedEmails = [];

      // Send emails to selected recipients
      for (const recipient of selectedRecipients) {
        try {
          const result = await sendMail({
            to: recipient.email,
            subject: subject,
            html: emailHtml
          });

          console.log(`✅ Manual report sent to: ${recipient.email}`);
          
          // Log the report
          await AlertModel.logAlert({
            type: `manual_${report_type}_report`,
            recipient_id: recipient.recipient_id,
            product_id: null,
            summary: `Manual ${report_type} report sent`
          });

          sentEmails.push(recipient.email);

        } catch (emailError) {
          console.error(`❌ Failed to send report to ${recipient.email}:`, emailError);
          failedEmails.push({ 
            email: recipient.email, 
            error: emailError.message 
          });
        }
      }

      return responseHelper.success(res, 'Manual reports processed', {
        report_type,
        sent_to: sentEmails,
        failed: failedEmails,
        total_sent: sentEmails.length,
        total_failed: failedEmails.length
      });

    } catch (error) {
      console.error('Send Manual Report Error:', error);
      return responseHelper.error(res, error.message, 500);
    }
  }
}

// ✅ Helper functions for generating reports
async function generateDailyReportHtml(date) {
  const SalesModel = require('../models/salesModel');
  const ProductModel = require('../models/productModel');
  
  try {
    const salesData = await SalesModel.getSalesByDate(date);
    const stockData = await ProductModel.getProducts({});
    
    const formattedDate = new Date(date).toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const totalRevenue = salesData.reduce((sum, sale) => sum + Number(sale.line_total || 0), 0);
    const totalOrders = [...new Set(salesData.map(sale => sale.order_id))].length;
    const totalItems = salesData.reduce((sum, sale) => sum + Number(sale.quantity || 0), 0);

    let salesRows = '';
    if (salesData.length > 0) {
      salesData.forEach(sale => {
        salesRows += `
          <tr style="border-bottom: 1px solid #e9ecef;">
            <td style="padding: 12px; border-right: 1px solid #e9ecef;">${sale.name}</td>
            <td style="padding: 12px; border-right: 1px solid #e9ecef; text-align: center;">${sale.quantity}</td>
            <td style="padding: 12px; border-right: 1px solid #e9ecef; text-align: right;">₹${Number(sale.unit_price || 0).toFixed(2)}</td>
            <td style="padding: 12px; text-align: right; font-weight: bold;">₹${Number(sale.line_total || 0).toFixed(2)}</td>
          </tr>
        `;
      });
    } else {
      salesRows = `<tr><td colspan="4" style="padding: 20px; text-align: center; color: #666;">No sales recorded for ${formattedDate}</td></tr>`;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Daily Sales Report</title>
        <style>
          @media only screen and (max-width: 600px) {
            .container { width: 100% !important; padding: 10px !important; }
            .summary-card { width: 100% !important; margin-bottom: 15px !important; }
            table { font-size: 12px !important; }
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background: #f8f9fa;">
        <div class="container" style="max-width: 800px; margin: 0 auto; background: white;">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #007bff, #0056b3); color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">📊 Daily Sales Report</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">${formattedDate}</p>
          </div>

          <!-- Summary Cards -->
          <div style="padding: 30px; background: #f8f9fa;">
            <div style="display: flex; flex-wrap: wrap; justify-content: space-between; gap: 15px;">
              <div class="summary-card" style="background: #e7f3ff; padding: 20px; border-radius: 8px; text-align: center; flex: 1; min-width: 200px; border: 1px solid #b6d7ff;">
                <h3 style="color: #0056b3; margin: 0 0 10px 0; font-size: 14px;">Total Revenue</h3>
                <p style="font-size: 24px; font-weight: bold; color: #0056b3; margin: 0;">₹${totalRevenue.toFixed(2)}</p>
              </div>
              <div class="summary-card" style="background: #e8f5e8; padding: 20px; border-radius: 8px; text-align: center; flex: 1; min-width: 200px; border: 1px solid #c3e6c3;">
                <h3 style="color: #0f5132; margin: 0 0 10px 0; font-size: 14px;">Total Orders</h3>
                <p style="font-size: 24px; font-weight: bold; color: #0f5132; margin: 0;">${totalOrders}</p>
              </div>
              <div class="summary-card" style="background: #fff3e0; padding: 20px; border-radius: 8px; text-align: center; flex: 1; min-width: 200px; border: 1px solid #ffcc80;">
                <h3 style="color: #bf360c; margin: 0 0 10px 0; font-size: 14px;">Items Sold</h3>
                <p style="font-size: 24px; font-weight: bold; color: #bf360c; margin: 0;">${totalItems}</p>
              </div>
            </div>
          </div>

          <!-- Sales Table -->
          <div style="padding: 30px;">
            <h3 style="color: #333; margin-bottom: 20px;">💰 Sales Breakdown</h3>
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #dee2e6;">
              <thead>
                <tr style="background: #f8f9fa;">
                  <th style="padding: 12px; border-right: 1px solid #dee2e6; text-align: left;">Product</th>
                  <th style="padding: 12px; border-right: 1px solid #dee2e6; text-align: center;">Quantity</th>
                  <th style="padding: 12px; border-right: 1px solid #dee2e6; text-align: right;">Unit Price</th>
                  <th style="padding: 12px; text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${salesRows}
              </tbody>
            </table>
          </div>

          <!-- Footer -->
          <div style="background: #2c3e50; color: white; padding: 20px; text-align: center;">
            <p style="margin: 0; font-size: 14px;">
              Generated by Restaurant Management System<br>
              ${new Date().toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  } catch (error) {
    console.error('Error generating daily report:', error);
    return '<h2>Error generating daily report</h2>';
  }
}

async function generatePeriodReportHtml(startDate, endDate, reportType) {
  const SalesModel = require('../models/salesModel');
  
  try {
    const reportData = await SalesModel.getSalesReport(startDate, endDate);
    const { summary, productBreakdown } = reportData;

    const typeLabels = {
      weekly: 'Weekly Report',
      monthly: 'Monthly Report', 
      custom: 'Custom Report'
    };

    const periodText = `${new Date(startDate).toLocaleDateString('en-IN')} - ${new Date(endDate).toLocaleDateString('en-IN')}`;

    let productRows = '';
    if (productBreakdown && productBreakdown.length > 0) {
      productBreakdown.slice(0, 10).forEach(product => {
        productRows += `
          <tr style="border-bottom: 1px solid #e9ecef;">
            <td style="padding: 10px; border-right: 1px solid #e9ecef;">${product.product_name}</td>
            <td style="padding: 10px; border-right: 1px solid #e9ecef; text-align: center;">${Number(product.total_quantity_sold || 0).toFixed(1)}</td>
            <td style="padding: 10px; border-right: 1px solid #e9ecef; text-align: right;">₹${Number(product.avg_unit_price || 0).toFixed(2)}</td>
            <td style="padding: 10px; text-align: right; font-weight: bold;">₹${Number(product.total_revenue || 0).toFixed(2)}</td>
          </tr>
        `;
      });
    } else {
      productRows = `<tr><td colspan="4" style="padding: 20px; text-align: center; color: #666;">No sales data for this period</td></tr>`;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${typeLabels[reportType]}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background: #f8f9fa;">
        <div style="max-width: 900px; margin: 0 auto; background: white;">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">📊 ${typeLabels[reportType]}</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">${periodText}</p>
          </div>

          <!-- Summary -->
          <div style="padding: 30px; background: #f8f9fa;">
            <div style="display: flex; flex-wrap: wrap; justify-content: space-between; gap: 15px;">
              <div style="background: #e7f3ff; padding: 20px; border-radius: 8px; text-align: center; flex: 1; min-width: 200px;">
                <h3 style="color: #0056b3; margin: 0 0 10px 0;">Total Revenue</h3>
                <p style="font-size: 24px; font-weight: bold; color: #0056b3; margin: 0;">₹${Number(summary?.total_revenue || 0).toFixed(2)}</p>
              </div>
              <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; text-align: center; flex: 1; min-width: 200px;">
                <h3 style="color: #0f5132; margin: 0 0 10px 0;">Total Orders</h3>
                <p style="font-size: 24px; font-weight: bold; color: #0f5132; margin: 0;">${summary?.total_orders || 0}</p>
              </div>
              <div style="background: #fff3e0; padding: 20px; border-radius: 8px; text-align: center; flex: 1; min-width: 200px;">
                <h3 style="color: #bf360c; margin: 0 0 10px 0;">Avg Order Value</h3>
                <p style="font-size: 24px; font-weight: bold; color: #bf360c; margin: 0;">₹${Number(summary?.avg_order_value || 0).toFixed(2)}</p>
              </div>
            </div>
          </div>

          <!-- Product Performance -->
          <div style="padding: 30px;">
            <h3 style="color: #333; margin-bottom: 20px;">🏆 Product Performance</h3>
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #dee2e6;">
              <thead>
                <tr style="background: #f8f9fa;">
                  <th style="padding: 12px; border-right: 1px solid #dee2e6; text-align: left;">Product</th>
                  <th style="padding: 12px; border-right: 1px solid #dee2e6; text-align: center;">Qty Sold</th>
                  <th style="padding: 12px; border-right: 1px solid #dee2e6; text-align: right;">Avg Price</th>
                  <th style="padding: 12px; text-align: right;">Total Revenue</th>
                </tr>
              </thead>
              <tbody>
                ${productRows}
              </tbody>
            </table>
          </div>

          <!-- Footer -->
          <div style="background: #2c3e50; color: white; padding: 20px; text-align: center;">
            <p style="margin: 0; font-size: 14px;">
              Generated by Restaurant Management System<br>
              ${new Date().toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  } catch (error) {
    console.error('Error generating period report:', error);
    return '<h2>Error generating report</h2>';
  }
}

module.exports = AlertController;
