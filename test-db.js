// test-db.js
require('dotenv').config();
const pool = require('./src/config/db');

async function test() {
    try {
        const res = await pool.query('SELECT NOW()');
        console.log('Heure actuelle de la base :', res.rows[0]);
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

test();