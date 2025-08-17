const XLSX = require('xlsx'); // ✅ Add this import
const { parseExcelFile } = require('../utils/excelParser');
const { validateBulkProducts } = require('../middleware/validateMiddleware');
const ProductModel = require('../models/productModel');

class ExcelService {
    
    // ✅ EXISTING: Keep your working product upload method
    static async processExcelUpload(filePath) {
        try {
            // Parse Excel file
            const rawProducts = parseExcelFile(filePath);
            
            if (rawProducts.length === 0) {
                throw new Error('No valid data found in Excel file');
            }
            
            // ✅ Clean products - remove empty keys and unwanted fields
            const cleanedProducts = rawProducts.map(product => {
                const cleaned = {};
                Object.keys(product).forEach(key => {
                    // Only keep non-empty keys and valid values
                    if (key && key.trim() !== '' && product[key] !== null && product[key] !== undefined) {
                        cleaned[key] = product[key];
                    }
                });
                return cleaned;
            }).filter(product => Object.keys(product).length > 0);
            
            console.log('Cleaned products:', JSON.stringify(cleanedProducts, null, 2));
            
            // Validate cleaned products
            const { validProducts, errors: validationErrors } = validateBulkProducts(cleanedProducts);
            
            if (validProducts.length === 0) {
                return {
                    success: false,
                    message: 'No valid products found in Excel file',
                    errors: validationErrors,
                    summary: {
                        totalRows: rawProducts.length,
                        validProducts: 0,
                        invalidProducts: validationErrors.length,
                        inserted: 0
                    }
                };
            }
            
            // Insert valid products to database
            const insertResult = await ProductModel.addBulkProducts(validProducts);
            
            // Combine all errors
            const allErrors = [...validationErrors, ...insertResult.failed];
            
            return {
                success: insertResult.successCount > 0,
                message: `Processing completed. ${insertResult.successCount} products added successfully.`,
                data: insertResult.successful,
                errors: allErrors.length > 0 ? allErrors : null,
                summary: {
                    totalRows: rawProducts.length,
                    validProducts: validProducts.length,
                    invalidProducts: validationErrors.length,
                    inserted: insertResult.successCount,
                    failed: insertResult.errorCount
                }
            };
            
        } catch (error) {
            throw new Error(`Excel processing failed: ${error.message}`);
        }
    }

    // ✅ NEW: Sales Excel upload method (enhanced)
  static async processSalesExcelUpload(filePath) {
    try {
        console.log('📊 Starting sales Excel processing:', filePath);

        // Read Excel file using XLSX
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        console.log('📊 Raw Excel data:', jsonData.length, 'rows');
        console.log('📊 First 3 rows:', JSON.stringify(jsonData.slice(0, 3), null, 2)); // ✅ DEBUG LINE

        if (jsonData.length === 0) {
            return { 
                success: false, 
                message: 'Excel file is empty', 
                errors: [],
                summary: { totalRows: 0, validSales: 0, invalidSales: 0, processed: 0 }
            };
        }

        // Clean and validate data
        const salesGroups = {};
        const errors = [];
        let validRowCount = 0;

        // ✅ DEBUG: Check what headers are actually present
        if (jsonData.length > 0) {
            const headers = Object.keys(jsonData);
            console.log('📋 Excel headers found:', headers);
        }

        for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i];
            const rowNum = i + 2; // Excel row number (1-indexed + header)

            try {
                console.log(`🔍 Processing row ${rowNum}:`, JSON.stringify(row, null, 2)); // ✅ DEBUG LINE

                // ✅ IMPROVED: More flexible field checking
                const saleDate = row.sale_date || row['sale_date'] || row.saleDate || row.date;
                const productName = row.product_name || row['product_name'] || row.productName || row.product || row.name;
                const quantity = row.quantity || row.qty || row.amount;
                const orderRef = row.order_ref || row['order_ref'] || row.orderRef || row.order || null;
                const notes = row.notes || row.note || row.description || null;

                console.log(`🔍 Extracted fields - Date: ${saleDate}, Product: ${productName}, Qty: ${quantity}`); // ✅ DEBUG LINE

                // Validate required fields
                if (!saleDate || !productName || !quantity) {
                    console.log(`❌ Row ${rowNum}: Missing fields - Date: ${!!saleDate}, Product: ${!!productName}, Qty: ${!!quantity}`);
                    errors.push(`Row ${rowNum}: Required fields missing. Found - Date: ${saleDate || 'missing'}, Product: ${productName || 'missing'}, Qty: ${quantity || 'missing'}`);
                    continue;
                }

                // Parse and validate date
                let saleDateFormatted;
                try {
                    saleDateFormatted = new Date(saleDate);
                    if (isNaN(saleDateFormatted.getTime())) {
                        errors.push(`Row ${rowNum}: Invalid sale_date '${saleDate}'. Use YYYY-MM-DD format`);
                        continue;
                    }
                    saleDateFormatted = saleDateFormatted.toISOString().slice(0, 10);
                } catch (dateError) {
                    errors.push(`Row ${rowNum}: Date parsing failed for '${saleDate}'`);
                    continue;
                }

                // Find product by name
                const { getPool, sql } = require('../config/db');
                const pool = getPool();
                const productResult = await pool.request()
                    .input('name', sql.VarChar, String(productName).trim())
                    .query('SELECT product_id, name, quantity as stock FROM products WHERE LOWER(name) = LOWER(@name)');

                if (productResult.recordset.length === 0) {
                    errors.push(`Row ${rowNum}: Product '${productName}' not found in database`);
                    continue;
                }

                const product = productResult.recordset[0];
                const quantityNum = parseFloat(quantity);

                // Validate quantity
                if (isNaN(quantityNum) || quantityNum <= 0) {
                    errors.push(`Row ${rowNum}: Invalid quantity '${quantity}'. Must be positive number`);
                    continue;
                }

                // Check stock availability
                if (product.stock < quantityNum) {
                    errors.push(`Row ${rowNum}: Insufficient stock for '${productName}'. Available: ${product.stock}, Requested: ${quantityNum}`);
                    continue;
                }

                // Group by sale_date and order_ref
                const orderReference = orderRef || `auto_${saleDateFormatted}_${Math.floor(i / 5)}`;
                const groupKey = `${saleDateFormatted}_${orderReference}`;

                if (!salesGroups[groupKey]) {
                    salesGroups[groupKey] = {
                        sale_date: saleDateFormatted,
                        items: [],
                        notes: notes || `Excel upload on ${new Date().toISOString().slice(0, 10)}`
                    };
                }

                salesGroups[groupKey].items.push({
                    product_id: product.product_id,
                    quantity: quantityNum,
                    product_name: product.name
                });

                validRowCount++;
                console.log(`✅ Row ${rowNum} validated: ${product.name} x ${quantityNum}`);

            } catch (error) {
                console.error(`❌ Row ${rowNum} processing error:`, error);
                errors.push(`Row ${rowNum}: Processing failed - ${error.message}`);
            }
        }

        // Rest of your existing code...
        const salesData = Object.values(salesGroups);
        
        if (salesData.length === 0) {
            return { 
                success: false, 
                message: 'No valid sales data found in Excel file', 
                errors: errors,
                summary: {
                    totalRows: jsonData.length,
                    validSales: 0,
                    invalidSales: errors.length,
                    processed: 0
                }
            };
        }

        // Process bulk sales
        const SalesModel = require('../models/salesModel');
        const result = await SalesModel.createBulkSales(salesData);

        return {
            success: result.summary.total_successful > 0,
            message: `Sales upload completed. ${result.summary.total_successful} orders created, ${result.summary.total_failed} failed`,
            data: {
                successful_sales: result.successful,
                failed_sales: result.failed,
                summary: result.summary
            },
            errors: errors.length > 0 ? errors : null
        };

    } catch (error) {
        console.error('❌ Sales Excel processing error:', error);
        return {
            success: false,
            message: `Failed to process Excel file: ${error.message}`,
            errors: [error.message]
        };
    }
}

}

module.exports = ExcelService;
