const nodeCron = require('node-cron');
const ProductModel = require('../models/productModel');
const AlertModel = require('../models/alertModel');
const { sendMail } = require('../services/emailService');

console.log('🔍 Low Stock Checker loaded');

// Every 60 minutes for testing
nodeCron.schedule('*/60 * * * *', async () => {
    console.log('[LowStockChecker] Running at:', new Date().toLocaleString());
    
    try {
        const lowStockProducts = await ProductModel.findLowStockProducts();
        if (!lowStockProducts.length) {
            console.log('✅ All products have sufficient stock');
            return;
        }

        const recipients = await AlertModel.getRecipients();
        console.log(`📧 Notifying ${recipients.length} recipients about ${lowStockProducts.length} low stock items`);

        // Create professional email HTML
        const emailHtml = createLowStockEmailHtml(lowStockProducts);

        for (const r of recipients) {
            try {
                await sendMail({
                    to: r.email,
                    subject: '🚨 Restaurant Stock Alert - Immediate Attention Required',
                    html: emailHtml
                });

                console.log(`✅ Low stock alert sent to: ${r.email}`);

                // Log each product alert
                for (const product of lowStockProducts) {
                    await AlertModel.logAlert({
                        type: 'low_stock',
                        recipient_id: r.recipient_id,
                        product_id: product.product_id,
                        summary: `Low stock alert: ${product.name} (${product.quantity} ${product.unit} left)`
                    });
                }

            } catch (emailError) {
                console.error(`❌ Failed to send alert to ${r.email}:`, emailError.message);
            }
        }

        console.log(`✅ [LowStockChecker] Successfully processed ${lowStockProducts.length} alerts`);

    } catch (error) {
        console.error('❌ [LowStockChecker] Error:', error);
    }
});

// Professional low stock email template
function createLowStockEmailHtml(products) {
    const currentDate = new Date().toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    let productRows = '';
    products.forEach(product => {
        const status = product.quantity === 0 ? 'OUT OF STOCK' : 'LOW STOCK';
        const statusColor = product.quantity === 0 ? '#dc3545' : '#fd7e14';
        
        productRows += `
            <tr style="border-bottom: 1px solid #dee2e6;">
                <td style="padding: 12px; border-right: 1px solid #dee2e6;">${product.name}</td>
                <td style="padding: 12px; border-right: 1px solid #dee2e6;">${product.category}</td>
                <td style="padding: 12px; border-right: 1px solid #dee2e6; text-align: center;">
                    <span style="color: ${statusColor}; font-weight: bold;">${product.quantity} ${product.unit}</span>
                </td>
                <td style="padding: 12px; text-align: center;">${product.reorder_level} ${product.unit}</td>
                <td style="padding: 12px; text-align: center;">
                    <span style="background: ${statusColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                        ${status}
                    </span>
                </td>
            </tr>
        `;
    });

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Stock Alert</title>
        </head>
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f8f9fa;">
            <div style="max-width: 800px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #dc3545, #fd7e14); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
                    <h1 style="margin: 0; font-size: 28px;">🚨 STOCK ALERT</h1>
                    <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Restaurant Inventory Management System</p>
                </div>

                <!-- Content -->
                <div style="padding: 30px;">
                    <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                        <strong>Date:</strong> ${currentDate}<br>
                        <strong>Alert Type:</strong> Low Stock Warning<br>
                        <strong>Priority:</strong> High
                    </p>

                    <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin-bottom: 25px;">
                        <h3 style="color: #856404; margin: 0 0 10px 0;">⚠️ Action Required</h3>
                        <p style="color: #856404; margin: 0;">
                            The following items require immediate restocking to maintain restaurant operations.
                        </p>
                    </div>

                    <h3 style="color: #333; margin-bottom: 15px;">📦 Items Requiring Attention:</h3>

                    <table style="width: 100%; border-collapse: collapse; border: 1px solid #dee2e6; margin-bottom: 25px;">
                        <thead>
                            <tr style="background: #f8f9fa;">
                                <th style="padding: 12px; border-right: 1px solid #dee2e6; text-align: left;">Product Name</th>
                                <th style="padding: 12px; border-right: 1px solid #dee2e6; text-align: left;">Category</th>
                                <th style="padding: 12px; border-right: 1px solid #dee2e6; text-align: center;">Current Stock</th>
                                <th style="padding: 12px; border-right: 1px solid #dee2e6; text-align: center;">Reorder Level</th>
                                <th style="padding: 12px; text-align: center;">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${productRows}
                        </tbody>
                    </table>

                    <!-- Actions -->
                    <div style="background: #e7f3ff; border: 1px solid #b6d7ff; border-radius: 6px; padding: 20px; margin-bottom: 20px;">
                        <h4 style="color: #0056b3; margin: 0 0 15px 0;">📋 Recommended Actions:</h4>
                        <ul style="color: #0056b3; margin: 0; padding-left: 20px;">
                            <li>Contact suppliers immediately for urgent restocking</li>
                            <li>Review sales forecast and adjust reorder levels if needed</li>
                            <li>Consider temporary menu adjustments for out-of-stock items</li>
                            <li>Update inventory records after receiving new stock</li>
                        </ul>
                    </div>

                    <!-- Footer -->
                    <div style="text-align: center; padding: 20px; border-top: 1px solid #dee2e6; margin-top: 30px;">
                        <p style="color: #666; margin: 0; font-size: 14px;">
                            This is an automated alert from your Restaurant Inventory Management System.<br>
                            Generated on ${new Date().toLocaleString('en-IN')}
                        </p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;
}
