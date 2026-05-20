const express = require('express');
const router = express.Router();
const {
    getNouvellesCommandes,
    getCommandesEnCours,
    getCommandesLivrees,
    prendreCommande,
    livrerCommande,
    abandonnerCommande,
} = require('../controllers/livreurController');
const { protect, isLivreur } = require('../middlewares/auth');

// ── Toutes les routes livreur nécessitent une authentification ──
router.use(protect, isLivreur);

/**
 * GET /api/livreur/orders/new
 * SCRUM-100 — Toutes les nouvelles commandes disponibles
 * Accès : Livreur connecté
 */
router.get('/orders/new', getNouvellesCommandes);

/**
 * GET /api/livreur/orders/in-progress
 * SCRUM-101 — Les commandes "prise" du livreur connecté
 * Accès : Livreur connecté
 */
router.get('/orders/in-progress', getCommandesEnCours);

/**
 * GET /api/livreur/orders/delivered
 * SCRUM-102 — Les commandes "livree" du livreur connecté
 * Accès : Livreur connecté
 */
router.get('/orders/delivered', getCommandesLivrees);

/**
 * PUT /api/livreur/orders/:id/take
 * SCRUM-103 — Prendre en charge une commande
 * Transition : "nouvelle" → "prise"
 * Accès : Livreur connecté
 */
router.put('/orders/:id/take', prendreCommande);

/**
 * PUT /api/livreur/orders/:id/deliver
 * SCRUM-105 — Faire avancer le statut d'une commande
 * Transition 1 : "prise"    → "en_cours"  (livreur en route)
 * Transition 2 : "en_cours" → "livree"    (livraison finalisée)
 * Accès : Livreur connecté + assigné à cette commande
 */
router.put('/orders/:id/deliver', livrerCommande);


router.put('/orders/:id/abandon', abandonnerCommande);

module.exports = router;

