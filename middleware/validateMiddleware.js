const Joi = require('joi');
const { responseHelper } = require('../utils/responseHelper');

const productSchema = Joi.object({
    name: Joi.string().min(2).max(255).required(),
    category: Joi.string().max(100).required(),
    unit: Joi.string().max(50).required(),
    quantity: Joi.number().min(0).required(),
    price: Joi.number().min(0).optional(),
    expiry_date: Joi.date().optional(),
    reorder_level: Joi.number().min(0).default(10),
    supplier_id: Joi.number().optional()
}).unknown(true); // ✅ Allow unknown fields (ignore extra keys)

const validateProduct = (req, res, next) => {
    const { error } = productSchema.validate(req.body);
    
    if (error) {
        return responseHelper.error(res, error.details[0].message, 400);
    }
    
    next();
};

const validateBulkProducts = (products) => {
    const results = [];
    const errors = [];
    
    products.forEach((product, index) => {
        const { error, value } = productSchema.validate(product);
        
        if (error) {
            errors.push({
                row: index + 2,
                error: error.details.message,
                data: product
            });
        } else {
            results.push(value);
        }
    });
    
    return { validProducts: results, errors };
};

module.exports = { validateProduct, validateBulkProducts };
