const nodeCron = require('node-cron');
const AlertModel = require('../models/alertModel');
const SalesModel = require('../models/salesModel');
const ProductModel = require('../models/productModel');
const { sendMail } = require('../services/emailService');

console.log('📊 Daily Report Mailer loaded');

// Every day at 9 PM (21:00)
nodeCron.schedule('0 21 * * *', async () => {
    console.log('📊 [DailyReportMailer] Generating daily sales report at:', new Date().toLocaleString());
    
    try {
        const recipients = await AlertModel.getRecipients();
        if (!recipients.length) {
            console.log('❌ No recipients found for daily report');
            return;
        }

        // Get today's date
        const today = new Date().toISOString().slice(0, 10);
        
        // Get today's sales data
        const salesData = await SalesModel.getSalesByDate(today);
        
        // Get current stock levels
        const stockData = await ProductModel.getProducts({});
        
        // Generate professional email
        const emailHtml = createDailyReportEmailHtml(salesData, stockData, today);

        // Send to all recipients
        for (const r of recipients) {
            try {
                await sendMail({
                    to: r.email,
                    subject: `📊 Daily Sales Report - ${new Date().toLocaleDateString('en-IN')}`,
                    html: emailHtml
                });

                console.log(`✅ Daily report sent to: ${r.email}`);

                // Log the report
                await AlertModel.logAlert({
                    type: 'daily_report',
                    recipient_id: r.recipient_id,
                    product_id: null,
                    summary: `Daily sales report sent for ${today}`
                });

            } catch (emailError) {
                console.error(`❌ Failed to send daily report to ${r.email}:`, emailError.message);
            }
        }

        console.log(`✅ [DailyReportMailer] Daily reports sent to ${recipients.length} recipients`);

    } catch (error) {
        console.error('❌ [DailyReportMailer] Error:', error);
    }
});

// Professional daily report email template
function createDailyReportEmailHtml(salesData, stockData, date) {
    const formattedDate = new Date(date).toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Calculate totals
    const totalRevenue = salesData.reduce((sum, sale) => sum + Number(sale.line_total), 0);
    const totalOrders = [...new Set(salesData.map(sale => sale.order_id))].length;
    const totalItems = salesData.reduce((sum, sale) => sum + Number(sale.quantity), 0);

    // Sales breakdown
    let salesRows = '';
    if (salesData.length > 0) {
        salesData.forEach(sale => {
            salesRows += `
                <tr style="border-bottom: 1px solid #dee2e6;">
                    <td style="padding: 10px; border-right: 1px solid #dee2e6;">${sale.name}</td>
                    <td style="padding: 10px; border-right: 1px solid #dee2e6; text-align: center;">${sale.quantity}</td>
                    <td style="padding: 10px; border-right: 1px solid #dee2e6; text-align: right;">₹${Number(sale.unit_price).toFixed(2)}</td>
                    <td style="padding: 10px; text-align: right; font-weight: bold;">₹${Number(sale.line_total).toFixed(2)}</td>
                </tr>
            `;
        });
    } else {
        salesRows = `
            <tr>
                <td colspan="4" style="padding: 20px; text-align: center; color: #666; font-style: italic;">
                    No sales recorded for today
                </td>
            </tr>
        `;
    }

    // Stock breakdown
    let stockRows = '';
    const lowStockItems = stockData.filter(item => item.quantity <= item.reorder_level);
    
    stockData.slice(0, 10).forEach(item => { // Show top 10 items
        const stockStatus = item.quantity <= item.reorder_level ? 'Low' : 'Good';
        const statusColor = item.quantity <= item.reorder_level ? '#dc3545' : '#28a745';
        
        stockRows += `
            <tr style="border-bottom: 1px solid #dee2e6;">
                <td style="padding: 10px; border-right: 1px solid #dee2e6;">${item.name}</td>
                <td style="padding: 10px; border-right: 1px solid #dee2e6; text-align: center;">${item.quantity} ${item.unit}</td>
                <td style="padding: 10px; text-align: center;">
                    <span style="color: ${statusColor}; font-weight: bold;">${stockStatus}</span>
                </td>
            </tr>
        `;
    });

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Daily Sales Report</title>
        </head>
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f8f9fa;">
            <div style="max-width: 900px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #007bff, #0056b3); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
                    <h1 style="margin: 0; font-size: 32px;">📊 Daily Sales Report</h1>
                    <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">${formattedDate}</p>
                </div>

                <!-- Summary Cards -->
                <div style="padding: 30px; border-bottom: 1px solid #dee2e6;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
                        <div style="background: #e7f3ff; padding: 20px; border-radius: 8px; text-align: center; width: 30%; border: 1px solid #b6d7ff;">
                            <h3 style="color: #0056b3; margin: 0 0 10px 0;">Total Revenue</h3>
                            <p style="font-size: 24px; font-weight: bold; color: #0056b3; margin: 0;">₹${totalRevenue.toFixed(2)}</p>
                        </div>
                        <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; text-align: center; width: 30%; border: 1px solid #c3e6c3;">
                            <h3 style="color: #0f5132; margin: 0 0 10px 0;">Total Orders</h3>
                            <p style="font-size: 24px; font-weight: bold; color: #0f5132; margin: 0;">${totalOrders}</p>
                        </div>
                        <div style="background: #fff3e0; padding: 20px; border-radius: 8px; text-align: center; width: 30%; border: 1px solid #ffcc80;">
                            <h3 style="color: #bf360c; margin: 0 0 10px 0;">Items Sold</h3>
                            <p style="font-size: 24px; font-weight: bold; color: #bf360c; margin: 0;">${totalItems}</p>
                        </div>
                    </div>
                </div>

                <!-- Sales Details -->
                <div style="padding: 30px; border-bottom: 1px solid #dee2e6;">
                    <h3 style="color: #333; margin-bottom: 20px;">💰 Today's Sales Breakdown</h3>
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

                <!-- Stock Status -->
                <div style="padding: 30px; border-bottom: 1px solid #dee2e6;">
                    <h3 style="color: #333; margin-bottom: 20px;">📦 Current Stock Status</h3>
                    ${lowStockItems.length > 0 ? `
                        <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin-bottom: 20px;">
                            <p style="color: #856404; margin: 0; font-weight: bold;">
                                ⚠️ Warning: ${lowStockItems.length} items are running low on stock!
                            </p>
                        </div>
                    ` : ''}
                    <table style="width: 100%; border-collapse: collapse; border: 1px solid #dee2e6;">
                        <thead>
                            <tr style="background: #f8f9fa;">
                                <th style="padding: 12px; border-right: 1px solid #dee2e6; text-align: left;">Product</th>
                                <th style="padding: 12px; border-right: 1px solid #dee2e6; text-align: center;">Current Stock</th>
                                <th style="padding: 12px; text-align: center;">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${stockRows}
                        </tbody>
                    </table>
                </div>

                <!-- Footer -->
                <div style="text-align: center; padding: 20px;">
                    <p style="color: #666; margin: 0; font-size: 14px;">
                        This automated report was generated by your Restaurant Management System<br>
                        Report generated on ${new Date().toLocaleString('en-IN')}<br>
                        <br>
                        <em>Have a great day ahead! 🍽️</em>
                    </p>
                </div>
            </div>
        </body>
        </html>
    `;
}
