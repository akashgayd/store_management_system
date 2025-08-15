const responseHelper = {
    success: (res, message, data = null, statusCode = 200) => {
        return res.status(statusCode).json({
            success: true,
            message,
            data,
            timestamp: new Date().toISOString()
        });
    },
    
    error: (res, message, statusCode = 500, errors = null) => {
        return res.status(statusCode).json({
            success: false,
            message,
            errors,
            timestamp: new Date().toISOString()
        });
    }
};

module.exports = { responseHelper };
