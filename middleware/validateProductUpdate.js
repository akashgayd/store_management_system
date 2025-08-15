const Joi = require('joi');
const { responseHelper } = require('../utils/responseHelper');

/* all fields optional but at least one must be present */
const updateSchema = Joi.object({
  name:         Joi.string().min(2).max(255),
  category:     Joi.string().max(100),
  unit:         Joi.string().max(50),
  quantity:     Joi.number().min(0),
  price:        Joi.number().min(0),
  expiry_date:  Joi.date().allow(null),
  reorder_level:Joi.number().min(0),
  supplier_id:  Joi.number().integer().allow(null)
}).min(1);                               // <-- at least one key

module.exports = (req, res, next) => {
  const { error } = updateSchema.validate(req.body);
  if (error) return responseHelper.error(res, error.details[0].message, 400);
  next();
};
