const Joi = require('joi');
const { responseHelper } = require('../utils/responseHelper');

const saleSchema = Joi.object({
  sale_date: Joi.date().iso().optional(),
  notes: Joi.string().max(500).optional(),
  items: Joi.array().items(
    Joi.object({
      product_id: Joi.number().integer().required(),
      quantity: Joi.number().positive().required()
    })
  ).min(1).required()
});

module.exports = (req, res, next) => {
  const { error } = saleSchema.validate(req.body);
  if (error) return responseHelper.error(res, error.details[0].message, 400);
  next();
};
