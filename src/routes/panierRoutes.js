// src/routes/panierRoutes.js
const express = require('express');
const router = express.Router();
const {
    validerPanier,
    ajouterAuPanier,
    modifierQuantite,
    supprimerDuPanier,
    recalculerMontant,
} = require('../controllers/panierController');

/**
 * POST /api/panier/ajouter
 * Ajoute un produit au panier
 * Body : { produit_id, quantite }
 * Accès : Public
 */
router.post('/ajouter', ajouterAuPanier);

/**
 * PUT /api/panier/modifier
 * Modifie la quantité d'un produit dans le panier
 * Body : { produit_id, quantite }
 * Accès : Public
 */
router.put('/modifier', modifierQuantite);

/**
 * DELETE /api/panier/supprimer/:produit_id
 * Supprime un produit du panier
 * Params : produit_id
 * Accès : Public
 */
router.delete('/supprimer/:produit_id', supprimerDuPanier);

/**
 * POST /api/panier/valider
 * Valide le panier complet et calcule le montant total
 * Body : { produits: [{ produit_id, quantite }] }
 * Accès : Public
 */
router.post('/valider', validerPanier);

/**
 * POST /api/panier/recalculer                  ← SCRUM-46
 * Recalcule le montant total avec les prix de la BDD
 * Vérifie la cohérence des prix
 * Body : { produits: [{ produit_id, quantite, prix_unitaire? }] }
 * Accès : Public
 */
router.post('/recalculer', recalculerMontant);

module.exports = router;
