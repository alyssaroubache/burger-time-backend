// src/routes/clientRoutes.js
const express = require('express');
const router = express.Router();
const { getCategories, getProduits, getCategoryById } = require('../controllers/clientController');

/**
 * GET /api/categories
 * Retourne toutes les catégories actives
 * Accès : Public (aucun token requis)
 */
router.get('/categories', getCategories);

/**
 * GET /api/produits
 * Retourne tous les produits disponibles
 * Accès : Public (aucun token requis)
 */
router.get('/produits', getProduits);

/**
 * GET /api/categories/:id
 * Retourne une catégorie spécifique
 */
router.get('/categories/:id', getCategoryById);

module.exports = router;
