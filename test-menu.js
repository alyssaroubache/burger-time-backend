// test-menu.js
require('dotenv').config();
const pool = require('./src/config/db');

async function getFullMenu() {
    try {
        const res = await pool.query(`
            SELECT c.nom AS categorie, p.nom, p.description, p.prix
            FROM produits p
            JOIN categories c ON p.categorie_id = c.id
            WHERE p.disponible = true
            ORDER BY c.ordre_affichage, p.nom
        `);
        console.log('🍔 Menu complet :');
        console.table(res.rows.slice(0, 10)); // affiche seulement les 10 premiers pour ne pas surcharger
    } catch (err) {
        console.error('Erreur :', err.message);
    } finally {
        pool.end();
    }
}

getFullMenu();