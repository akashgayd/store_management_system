const XLSX = require('xlsx');
const fs = require('fs');

const parseExcelFile = (filePath) => {
    try {
        // Read the Excel file
        const workbook = XLSX.readFile(filePath);
        
        // Get the first sheet name
        const sheetName = workbook.SheetNames[0];
        
        // Get the worksheet
        const worksheet = workbook.Sheets[sheetName];
        
        // ✅ CORRECT: sheet_to_json (not sheet_json)
        const data = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: null
        });
        
        // Remove the file after parsing
        fs.unlinkSync(filePath);
        
        if (data.length < 2) {
            throw new Error('Excel file must contain at least header row and one data row');
        }
        
        // Extract headers and force to strings
        const headers = data[0].map(h => h ? h.toString().trim() : '').filter(h => h !== '');
        const rows = data.slice(1);
        
        // Map data to objects
        const products = rows.map(row => {
            const product = {};
            headers.forEach((header, index) => {
                if (header && row[index] !== null && row[index] !== undefined) {
                    const key = header.toLowerCase().replace(/\s+/g, '_');
                    product[key] = row[index];
                }
            });
            return product;
        }).filter(product => Object.keys(product).length > 0);
        
        return products;
        
    } catch (error) {
        // Clean up file if parsing fails
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        throw new Error(`Excel parsing failed: ${error.message}`);
    }
};

module.exports = { parseExcelFile };
