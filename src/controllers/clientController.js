// src/controllers/clientController.js
const pool = require('../config/db');

// ─────────────────────────────────────────────────────────────
// GET /api/categories
// Retourne la liste de toutes les catégories actives
// ─────────────────────────────────────────────────────────────
const getCategories = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, nom, description, url_image, ordre_affichage
       FROM categories
       WHERE actif = true
       ORDER BY ordre_affichage ASC`
        );

        return res.status(200).json({
            success: true,
            data: result.rows,
        });

    } catch (err) {
        console.error('Erreur getCategories :', err.message);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur. Veuillez réessayer.',
        });
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/produits
// GET /api/produits?category_id=X
// Retourne tous les produits disponibles
// Si category_id est fourni → filtre par catégorie
// ─────────────────────────────────────────────────────────────
const getProduits = async (req, res) => {
    const { category_id } = req.query;

    try {
        if (category_id && isNaN(category_id)) {
            return res.status(400).json({
                success: false,
                message: 'category_id doit être un nombre valide.',
            });
        }

        let query = `
      SELECT p.id, p.nom, p.description, p.prix, p.url_image,
             c.nom AS categorie
      FROM produits p
      JOIN categories c ON p.categorie_id = c.id
      WHERE p.disponible = true
    `;
        const params = [];

        if (category_id) {
            params.push(parseInt(category_id));
            query += ` AND p.categorie_id = $${params.length}`;
        }

        query += ` ORDER BY p.nom ASC`;

        const result = await pool.query(query, params);

        return res.status(200).json({
            success: true,
            filtre: category_id ? `category_id = ${category_id}` : 'aucun',
            total: result.rows.length,
            data: result.rows,
        });

    } catch (err) {
        console.error('Erreur getProduits :', err.message);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur. Veuillez réessayer.',
        });
    }
};

const getCategoryById = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            `SELECT id, nom, description, url_image, ordre_affichage
             FROM categories
             WHERE id = $1 AND actif = true`,
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Catégorie non trouvée'
            });
        }
        return res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (err) {
        console.error('Erreur getCategoryById :', err.message);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur'
        });
    }
};
module.exports = { getCategories, getProduits, getCategoryById };
