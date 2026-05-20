// src/routes/commandeRoutes.js
const express = require('express');
const router = express.Router();
const { creerCommande, getCommande } = require('../controllers/commandeController');

/**
 * POST /api/orders
 * Crée une nouvelle commande
 * Accès : Public (aucun token requis)
 * delivery_fee = 200 DA ajouté automatiquement côté serveur
 */
router.post('/', creerCommande);

/**
 * GET /api/orders/:id
 * Retourne le détail d'une commande avec delivery_fee
 * Accès : Public
 */
router.get('/:id', getCommande);

module.exports = router;