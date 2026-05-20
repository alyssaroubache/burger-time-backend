// src/controllers/authController.js
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const generateToken = require('../utils/generateToken');

// ─────────────────────────────────────────────────────────────
// Utilitaire interne : logique de connexion partagée
// Utilisée par /connexion et /login
// ─────────────────────────────────────────────────────────────
const _authentifier = async (email, mot_de_passe, res) => {

    // 1. Vérifier que les champs sont fournis
    if (!email || !mot_de_passe) {
        return res.status(400).json({
            success: false,
            message: 'Email et mot de passe sont obligatoires.',
        });
    }

    // 2. Chercher l'utilisateur actif par email
    const result = await pool.query(
        `SELECT * FROM utilisateurs WHERE email = $1 AND actif = true`,
        [email]
    );

    const user = result.rows[0];

    // 3. Vérifier que l'utilisateur existe
    if (!user) {
        return res.status(401).json({
            success: false,
            message: 'Identifiants incorrects.',
        });
    }

    // 4. Vérifier le mot de passe avec bcrypt
    const motDePasseValide = await bcrypt.compare(mot_de_passe, user.mot_de_passe_hash);

    if (!motDePasseValide) {
        return res.status(401).json({
            success: false,
            message: 'Identifiants incorrects.',
        });
    }

    // 5. Mettre à jour la dernière connexion
    await pool.query(
        `UPDATE utilisateurs SET derniere_connexion = NOW() WHERE id = $1`,
        [user.id]
    );

    // 6. Générer le token JWT
    const token = generateToken(user);

    // 7. Retourner la réponse
    return res.status(200).json({
        success: true,
        message: 'Connexion réussie.',
        token,
        user: {
            id: user.id,
            nom_complet: user.nom_complet,
            email: user.email,
            role: user.role,
        },
    });
};

/*// ─────────────────────────────────────────────────────────────
// POST /api/auth/connexion
// Route originale — Sprint 0
// ─────────────────────────────────────────────────────────────
const connexion = async (req, res) => {
    const { email, mot_de_passe } = req.body;
    try {
        await _authentifier(email, mot_de_passe, res);
    } catch (err) {
        console.error('Erreur connexion :', err.message);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur. Veuillez réessayer.',
        });
    }
};*/

// ─────────────────────────────────────────────────────────────
// POST /api/auth/login
// SCRUM-98 — Route pour l'interface livreur (Sprint 4)
// Accepte email + password (standard international)
// ─────────────────────────────────────────────────────────────
const login = async (req, res) => {
    // Accepte password ou mot_de_passe
    const { email, password, mot_de_passe } = req.body;
    const mdp = password || mot_de_passe;

    try {
        await _authentifier(email, mdp, res);
    } catch (err) {
        console.error('Erreur login :', err.message);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur. Veuillez réessayer.',
        });
    }
};

module.exports = { login };
