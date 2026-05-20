// src/controllers/panierController.js
const pool = require('../config/db');

// ─────────────────────────────────────────────────────────────
// POST /api/panier/valider
// Valide le contenu du panier envoyé par le frontend
// Vérifie que les produits existent et sont disponibles
// Calcule le montant total côté serveur
// ─────────────────────────────────────────────────────────────
const validerPanier = async (req, res) => {
    const { produits } = req.body;

    // 1. Vérifier que le panier n'est pas vide
    if (!produits || !Array.isArray(produits) || produits.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Le panier est vide.',
        });
    }

    // 2. Vérifier que chaque produit a un produit_id et une quantité valide
    for (const item of produits) {
        if (!item.produit_id || !item.quantite) {
            return res.status(400).json({
                success: false,
                message: 'Chaque produit doit avoir un produit_id et une quantite.',
            });
        }
        if (isNaN(item.produit_id) || isNaN(item.quantite)) {
            return res.status(400).json({
                success: false,
                message: 'produit_id et quantite doivent être des nombres valides.',
            });
        }
        if (parseInt(item.quantite) <= 0) {
            return res.status(400).json({
                success: false,
                message: 'La quantite doit être supérieure à 0.',
            });
        }
    }

    try {
        // 3. Récupérer les infos des produits depuis la BDD
        const ids = produits.map(p => parseInt(p.produit_id));
        const result = await pool.query(
            `SELECT p.id, p.nom, p.prix, p.disponible, c.nom AS categorie
             FROM produits p
             JOIN categories c ON p.categorie_id = c.id
             WHERE p.id = ANY($1)`,
            [ids]
        );

        // 4. Vérifier que tous les produits existent
        if (result.rows.length !== ids.length) {
            return res.status(404).json({
                success: false,
                message: 'Un ou plusieurs produits sont introuvables.',
            });
        }

        // 5. Vérifier que tous les produits sont disponibles
        const produitsIndisponibles = result.rows.filter(p => !p.disponible);
        if (produitsIndisponibles.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Ces produits ne sont plus disponibles : ${produitsIndisponibles.map(p => p.nom).join(', ')}`,
            });
        }

        // 6. Calculer le montant total côté serveur
        const prixMap = {};
        result.rows.forEach(p => { prixMap[p.id] = p; });

        let montantTotal = 0;
        const panierDetail = produits.map(item => {
            const produit = prixMap[parseInt(item.produit_id)];
            const quantite = parseInt(item.quantite);
            const sousTotal = parseFloat(produit.prix) * quantite;
            montantTotal += sousTotal;

            return {
                produit_id: produit.id,
                nom: produit.nom,
                categorie: produit.categorie,
                prix_unitaire: parseFloat(produit.prix),
                quantite,
                sous_total: sousTotal,
            };
        });

        // 7. Retourner le panier validé avec le montant total
        return res.status(200).json({
            success: true,
            message: 'Panier validé avec succès.',
            nb_articles: produits.reduce((acc, p) => acc + parseInt(p.quantite), 0),
            montant_total: montantTotal,
            produits: panierDetail,
        });

    } catch (err) {
        console.error('Erreur validerPanier :', err.message);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur. Veuillez réessayer.',
        });
    }
};

// ─────────────────────────────────────────────────────────────
// POST /api/panier/ajouter
// Ajoute un produit au panier
// Vérifie que le produit existe et est disponible
// ─────────────────────────────────────────────────────────────
const ajouterAuPanier = async (req, res) => {
    const { produit_id, quantite } = req.body;

    // 1. Vérifier les champs obligatoires
    if (!produit_id || !quantite) {
        return res.status(400).json({
            success: false,
            message: 'produit_id et quantite sont obligatoires.',
        });
    }

    if (isNaN(produit_id) || isNaN(quantite)) {
        return res.status(400).json({
            success: false,
            message: 'produit_id et quantite doivent être des nombres valides.',
        });
    }

    if (parseInt(quantite) <= 0) {
        return res.status(400).json({
            success: false,
            message: 'La quantite doit être supérieure à 0.',
        });
    }

    try {
        // 2. Vérifier que le produit existe et est disponible
        const result = await pool.query(
            `SELECT p.id, p.nom, p.prix, p.disponible,
                    p.url_image, c.nom AS categorie
             FROM produits p
             JOIN categories c ON p.categorie_id = c.id
             WHERE p.id = $1`,
            [parseInt(produit_id)]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Produit introuvable.',
            });
        }

        const produit = result.rows[0];

        if (!produit.disponible) {
            return res.status(400).json({
                success: false,
                message: `Le produit "${produit.nom}" n'est plus disponible.`,
            });
        }

        // 3. Retourner les infos du produit à ajouter au panier
        return res.status(200).json({
            success: true,
            message: `"${produit.nom}" ajouté au panier.`,
            produit: {
                produit_id: produit.id,
                nom: produit.nom,
                categorie: produit.categorie,
                prix_unitaire: parseFloat(produit.prix),
                url_image: produit.url_image,
                quantite: parseInt(quantite),
                sous_total: parseFloat(produit.prix) * parseInt(quantite),
            },
        });

    } catch (err) {
        console.error('Erreur ajouterAuPanier :', err.message);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur. Veuillez réessayer.',
        });
    }
};

// ─────────────────────────────────────────────────────────────
// PUT /api/panier/modifier
// Modifie la quantité d'un produit dans le panier
// Vérifie que le produit existe et que la quantité est valide
// ─────────────────────────────────────────────────────────────
const modifierQuantite = async (req, res) => {
    const { produit_id, quantite } = req.body;

    // 1. Vérifier les champs obligatoires
    if (!produit_id || quantite === undefined) {
        return res.status(400).json({
            success: false,
            message: 'produit_id et quantite sont obligatoires.',
        });
    }

    if (isNaN(produit_id) || isNaN(quantite)) {
        return res.status(400).json({
            success: false,
            message: 'produit_id et quantite doivent être des nombres valides.',
        });
    }

    if (parseInt(quantite) <= 0) {
        return res.status(400).json({
            success: false,
            message: 'La quantite doit être supérieure à 0. Pour supprimer, utilisez DELETE /api/panier/supprimer.',
        });
    }

    try {
        // 2. Vérifier que le produit existe et est disponible
        const result = await pool.query(
            `SELECT id, nom, prix, disponible
             FROM produits
             WHERE id = $1`,
            [parseInt(produit_id)]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Produit introuvable.',
            });
        }

        const produit = result.rows[0];

        if (!produit.disponible) {
            return res.status(400).json({
                success: false,
                message: `Le produit "${produit.nom}" n'est plus disponible.`,
            });
        }

        // 3. Retourner les infos mises à jour
        const nouvelleQuantite = parseInt(quantite);
        const nouveauSousTotal = parseFloat(produit.prix) * nouvelleQuantite;

        return res.status(200).json({
            success: true,
            message: `Quantité mise à jour pour "${produit.nom}".`,
            produit: {
                produit_id: produit.id,
                nom: produit.nom,
                prix_unitaire: parseFloat(produit.prix),
                quantite: nouvelleQuantite,
                sous_total: nouveauSousTotal,
            },
        });

    } catch (err) {
        console.error('Erreur modifierQuantite :', err.message);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur. Veuillez réessayer.',
        });
    }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/panier/supprimer/:produit_id
// Supprime un produit du panier
// Vérifie que le produit existe
// ─────────────────────────────────────────────────────────────
const supprimerDuPanier = async (req, res) => {
    const { produit_id } = req.params;

    if (!produit_id || isNaN(produit_id)) {
        return res.status(400).json({
            success: false,
            message: 'produit_id invalide.',
        });
    }

    try {
        // Vérifier que le produit existe
        const result = await pool.query(
            `SELECT id, nom FROM produits WHERE id = $1`,
            [parseInt(produit_id)]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Produit introuvable.',
            });
        }

        const produit = result.rows[0];

        return res.status(200).json({
            success: true,
            message: `"${produit.nom}" supprimé du panier.`,
            produit_id: produit.id,
        });

    } catch (err) {
        console.error('Erreur supprimerDuPanier :', err.message);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur. Veuillez réessayer.',
        });
    }
};

// ─────────────────────────────────────────────────────────────
// POST /api/panier/recalculer                   ← SCRUM-46
// Recalcul du montant total côté serveur
// Récupère les prix depuis la BDD (pas depuis le frontend)
// Vérifie la cohérence avec les prix stockés en base
// ─────────────────────────────────────────────────────────────
const recalculerMontant = async (req, res) => {
    const { produits } = req.body;

    // 1. Vérifier que le panier n'est pas vide
    if (!produits || !Array.isArray(produits) || produits.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Le panier est vide.',
        });
    }

    // 2. Vérifier que chaque produit a produit_id et quantite valides
    for (const item of produits) {
        if (!item.produit_id || !item.quantite) {
            return res.status(400).json({
                success: false,
                message: 'Chaque produit doit avoir un produit_id et une quantite.',
            });
        }
        if (isNaN(item.produit_id) || isNaN(item.quantite)) {
            return res.status(400).json({
                success: false,
                message: 'produit_id et quantite doivent être des nombres valides.',
            });
        }
        if (parseInt(item.quantite) <= 0) {
            return res.status(400).json({
                success: false,
                message: 'La quantite doit être supérieure à 0.',
            });
        }
    }

    try {
        // 3. Récupérer les VRAIS prix depuis la BDD
        // On ignore complètement les prix envoyés par le frontend
        const ids = produits.map(p => parseInt(p.produit_id));
        const result = await pool.query(
            `SELECT p.id, p.nom, p.prix, p.disponible, c.nom AS categorie
             FROM produits p
             JOIN categories c ON p.categorie_id = c.id
             WHERE p.id = ANY($1)`,
            [ids]
        );

        // 4. Vérifier que tous les produits existent
        if (result.rows.length !== ids.length) {
            return res.status(404).json({
                success: false,
                message: 'Un ou plusieurs produits sont introuvables.',
            });
        }

        // 5. Vérifier que tous les produits sont disponibles
        const produitsIndisponibles = result.rows.filter(p => !p.disponible);
        if (produitsIndisponibles.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Ces produits ne sont plus disponibles : ${produitsIndisponibles.map(p => p.nom).join(', ')}`,
            });
        }

        // 6. Recalculer le montant total avec les prix de la BDD
        const prixMap = {};
        result.rows.forEach(p => { prixMap[p.id] = p; });

        let montantTotal = 0;
        let anomalies = []; // Détecter les incohérences de prix
        const panierDetail = produits.map(item => {
            const produit = prixMap[parseInt(item.produit_id)];
            const quantite = parseInt(item.quantite);
            const prixBDD = parseFloat(produit.prix);
            const sousTotal = prixBDD * quantite;
            montantTotal += sousTotal;

            // Vérifier la cohérence si le frontend envoie aussi un prix
            if (item.prix_unitaire && parseFloat(item.prix_unitaire) !== prixBDD) {
                anomalies.push({
                    produit_id: produit.id,
                    nom: produit.nom,
                    prix_frontend: parseFloat(item.prix_unitaire),
                    prix_bdd: prixBDD,
                });
            }

            return {
                produit_id: produit.id,
                nom: produit.nom,
                categorie: produit.categorie,
                prix_unitaire: prixBDD,
                quantite,
                sous_total: sousTotal,
            };
        });

        // 7. Retourner le montant recalculé
        return res.status(200).json({
            success: true,
            message: 'Montant recalculé avec les prix de la base de données.',
            nb_articles: produits.reduce((acc, p) => acc + parseInt(p.quantite), 0),
            montant_total: parseFloat(montantTotal.toFixed(2)),
            anomalies: anomalies.length > 0 ? anomalies : [],
            coherent: anomalies.length === 0,
            produits: panierDetail,
        });

    } catch (err) {
        console.error('Erreur recalculerMontant :', err.message);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur. Veuillez réessayer.',
        });
    }
};

module.exports = {
    validerPanier,
    ajouterAuPanier,
    modifierQuantite,
    supprimerDuPanier,
    recalculerMontant,
};
