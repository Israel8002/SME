const sqlite3 = require('sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database', 'sme.db');
const db = new sqlite3.Database(DB_PATH);

db.get("SELECT COUNT(*) as count FROM unit_ips", [], (err, row) => {
  if (err) {
    console.error(err);
  } else {
    console.log("Current unit_ips count:", row.count);
  }
  db.close();
});
