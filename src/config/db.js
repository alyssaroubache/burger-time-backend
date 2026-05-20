// src/config/db.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

pool.connect((err, client, release) => {
    if (err) {
        return console.error('❌ Erreur de connexion à PostgreSQL :', err.stack);
    }
    console.log('✅ Connecté à PostgreSQL');
    release();
});

module.exports = pool;