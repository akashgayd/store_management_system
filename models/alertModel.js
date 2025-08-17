const { getPool, sql } = require('../config/db');

class AlertModel {
  // Get all recipients (enabled only)
  static async getRecipients(active=true) {
    const pool = getPool();
    let q = 'SELECT recipient_id, email FROM alert_recipients';
    if (active) q += ' WHERE enabled = 1';
    return (await pool.request().query(q)).recordset;
  }
  // Add a new recipient
  static async addRecipient(email) {
    const pool = getPool();
    return await pool.request()
      .input('email', sql.VarChar, email)
      .query('INSERT INTO alert_recipients (email) OUTPUT INSERTED.* VALUES (@email)');
  }
  // Log an alert
  static async logAlert({ type, recipient_id, product_id, summary }) {
    const pool = getPool();
    return await pool.request()
      .input('type', sql.VarChar, type)
      .input('recipient_id', sql.Int, recipient_id)
      .input('product_id', sql.Int, product_id || null)
      .input('summary', sql.NVarChar, summary)
      .query('INSERT INTO alert_logs (type, recipient_id, product_id, summary) VALUES (@type, @recipient_id, @product_id, @summary)');
  }



  // this is manual mail system
// Get recipients by type (auto alerts or manual reports)
static async getRecipientsByType(type = 'auto') {
  const pool = getPool();
  const field = type === 'auto' ? 'auto_alerts' : 'manual_reports';
  const query = `SELECT recipient_id, email FROM alert_recipients WHERE enabled = 1 AND ${field} = 1`;
  return (await pool.request().query(query)).recordset;
}

// Get all recipients with their settings
static async getAllRecipientsWithSettings() {
  const pool = getPool();
  return (await pool.request().query(`
    SELECT recipient_id, email, enabled, auto_alerts, manual_reports 
    FROM alert_recipients 
    ORDER BY email
  `)).recordset;
}

// Update recipient settings
static async updateRecipientSettings(id, settings) {
  const pool = getPool();
  const { enabled, auto_alerts, manual_reports } = settings;
  
  return await pool.request()
    .input('id', sql.Int, id)
    .input('enabled', sql.Bit, enabled)
    .input('auto_alerts', sql.Bit, auto_alerts)
    .input('manual_reports', sql.Bit, manual_reports)
    .query(`
      UPDATE alert_recipients 
      SET enabled = @enabled, auto_alerts = @auto_alerts, manual_reports = @manual_reports
      WHERE recipient_id = @id
    `);
}


}

module.exports = AlertModel;
