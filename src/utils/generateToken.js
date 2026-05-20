// src/utils/generateToken.js
const jwt = require('jsonwebtoken');

/**
 * Génère un token JWT signé pour un utilisateur.
 * @param {Object} user - doit contenir { id, role }
 * @returns {string} token JWT valide 8 heures
 */
const generateToken = (user) => {
    return jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
    );
};

module.exports = generateToken;