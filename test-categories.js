// test-categories.js
require('dotenv').config();
const pool = require('./src/config/db');

async function getCategories() {
    try {
        const res = await pool.query('SELECT * FROM categories ORDER BY ordre_affichage');
        console.log('📋 Catégories :');
        console.table(res.rows);
    } catch (err) {
        console.error('Erreur :', err.message);
    } finally {
        pool.end();
    }
}

getCategories();