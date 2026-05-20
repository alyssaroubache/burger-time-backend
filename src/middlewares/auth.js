// src/middlewares/auth.js
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// ─────────────────────────────────────────────────────────────
// SCRUM-99 : Middleware JWT
// Vérifie le token sur toutes les routes protégées
// ─────────────────────────────────────────────────────────────

/**
 * protect — Vérifie la présence et la validité du token JWT.
 * Ajoute req.user = { id, role, email, nom_complet } si valide.
 * À utiliser sur toutes les routes privées.
 */
const protect = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    // 1. Vérifier la présence du token
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            code: 'TOKEN_MANQUANT',
            message: 'Accès refusé. Token manquant ou mal formaté.',
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        // 2. Vérifier et décoder le token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 3. Vérifier que l'utilisateur existe toujours et est actif
        const result = await pool.query(
            `SELECT id, nom_complet, email, role, actif
             FROM utilisateurs WHERE id = $1`,
            [decoded.id]
        );

        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({
                success: false,
                code: 'UTILISATEUR_INTROUVABLE',
                message: 'Utilisateur introuvable. Token invalide.',
            });
        }

        // 4. Vérifier que le compte est encore actif
        if (!user.actif) {
            return res.status(401).json({
                success: false,
                code: 'COMPTE_DESACTIVE',
                message: 'Votre compte a été désactivé. Contactez l\'administrateur.',
            });
        }

        // 5. Attacher l'utilisateur à la requête
        req.user = {
            id: user.id,
            nom_complet: user.nom_complet,
            email: user.email,
            role: user.role,
        };

        next();

    } catch (err) {
        // Gérer les différents types d'erreurs JWT
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                code: 'TOKEN_EXPIRE',
                message: 'Session expirée. Veuillez vous reconnecter.',
            });
        }

        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                code: 'TOKEN_INVALIDE',
                message: 'Token invalide. Veuillez vous reconnecter.',
            });
        }

        return res.status(401).json({
            success: false,
            code: 'AUTH_ERREUR',
            message: 'Erreur d\'authentification.',
        });
    }
};

/**
 * isAdmin — Autorise uniquement les administrateurs.
 * À utiliser après protect.
 */
const isAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({
            success: false,
            code: 'ACCES_REFUSE',
            message: 'Accès réservé aux administrateurs.',
        });
    }
    next();
};

/**
 * isLivreur — Autorise uniquement les livreurs.
 * À utiliser après protect.
 */
const isLivreur = (req, res, next) => {
    if (req.user?.role !== 'livreur') {
        return res.status(403).json({
            success: false,
            code: 'ACCES_REFUSE',
            message: 'Accès réservé aux livreurs.',
        });
    }
    next();
};

/**
 * isAdminOrLivreur — Autorise admins ET livreurs.
 * À utiliser après protect.
 */
const isAdminOrLivreur = (req, res, next) => {
    if (!['admin', 'livreur'].includes(req.user?.role)) {
        return res.status(403).json({
            success: false,
            code: 'ACCES_REFUSE',
            message: 'Accès réservé aux livreurs et administrateurs.',
        });
    }
    next();
};

module.exports = { protect, isAdmin, isLivreur, isAdminOrLivreur };
