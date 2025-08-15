const upload = require('../config/multer');
const { responseHelper } = require('../utils/responseHelper');

const handleFileUpload = (req, res, next) => {
    upload.single('excelFile')(req, res, (err) => {
        if (err) {
            return responseHelper.error(res, err.message, 400);
        }
        next();
    });
};

module.exports = { handleFileUpload };
