const sql = require('mssql');

const config = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'sne@1234',
    server: process.env.DB_SERVER || '192.168.34.99',
    database: process.env.DB_DATABASE || 'RestaurantStockDB',
    options: {
        encrypt: false,
        trustServerCertificate: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let pool;

const connectDB = async () => {
    try {
        pool = await sql.connect(config);
        console.log('✅ Connected to SQL Server');
        return pool;
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        process.exit(1);
    }
};

const getPool = () => {
    if (!pool) {
        throw new Error('Database not connected');
    }
    return pool;
};

module.exports = { connectDB, getPool, sql };
// This module exports the database connection and configuration for use in other parts of the application.