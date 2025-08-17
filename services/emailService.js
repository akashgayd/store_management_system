const transporter = require('../config/nodemailer');

const sendMail = async ({ to, subject, html }) => {
    try {
        console.log(`📤 Preparing to send email to: ${to}`);
        console.log(`📋 Subject: ${subject}`);
        
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: Array.isArray(to) ? to.join(',') : to,
            subject,
            html
        };

        console.log(`📧 Sending email via SMTP...`);
        const result = await transporter.sendMail(mailOptions);

        console.log(`✅ Email sent successfully!`);
        console.log(`📬 Message ID: ${result.messageId}`);
        console.log(`📊 Response: ${result.response}`);

        return result;

    } catch (error) {
        console.error('❌ Email sending failed:');
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        console.error('Full error:', error);
        
        throw error;
    }
};

module.exports = { sendMail };
