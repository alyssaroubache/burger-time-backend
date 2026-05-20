// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { login } = require('../controllers/authController');

/**
 * POST /api/auth/connexion
 * Route originale — Connexion livreur/admin (Sprint 0)
 * Body : { email, mot_de_passe }
 */
//router.post('/connexion', connexion);

/**
 * POST /api/auth/login
 * SCRUM-98 — Route standard pour l'interface livreur (Sprint 4)
 * Body : { email, password } ou { email, mot_de_passe }
 */
router.post('/login', login);

module.exports = router;
