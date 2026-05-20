const { envoyerConfirmationCommande } = require('../services/emailService');

// src/controllers/commandeController.js
const pool = require('../config/db');
const { notifierNouvelleCommande } = require('../socket');

// ─────────────────────────────────────────────────────────────
// CONSTANTE : Frais de livraison fixes (DA)
// Modifiable ici en un seul endroit
// ─────────────────────────────────────────────────────────────
const DELIVERY_FEE = 200;

// ─────────────────────────────────────────────────────────────
// POST /api/orders
// Crée une nouvelle commande
// ─────────────────────────────────────────────────────────────
const creerCommande = async (req, res) => {
    const {
        prenom,
        nom,
        telephone,
        email,
        adresse_livraison,
        livraison_lat,
        livraison_lng,
        instructions_livraison,
        heure_prevue,
        produits,
        instructions
    } = req.body;

    // ── Validation des champs obligatoires ─────────────────────
    if (!prenom || prenom.trim() === '') {
        return res.status(400).json({ success: false, champ: 'prenom', message: 'Le prénom est obligatoire.' });
    }
    if (!nom || nom.trim() === '') {
        return res.status(400).json({ success: false, champ: 'nom', message: 'Le nom est obligatoire.' });
    }
    if (!telephone || telephone.trim() === '') {
        return res.status(400).json({ success: false, champ: 'telephone', message: 'Le téléphone est obligatoire.' });
    }

    const telephoneNet = telephone.trim().replace(/\D/g, '');
    const telephoneRegex = /^(0)(5|6|7)[0-9]{8}$/;
    if (!telephoneRegex.test(telephoneNet)) {
        return res.status(400).json({
            success: false,
            champ: 'telephone',
            message: 'Format de téléphone invalide. Exemple : 0555123456',
        });
    }

    if (!adresse_livraison || adresse_livraison.trim() === '') {
        return res.status(400).json({ success: false, champ: 'adresse_livraison', message: "L'adresse de livraison est obligatoire." });
    }
    if (!heure_prevue) {
        return res.status(400).json({ success: false, champ: 'heure_prevue', message: "L'heure de livraison est obligatoire." });
    }

    const heureLivraison = new Date(heure_prevue);
    if (isNaN(heureLivraison.getTime())) {
        return res.status(400).json({ success: false, champ: 'heure_prevue', message: 'Format de date invalide.' });
    }
    if (heureLivraison <= new Date()) {
        return res.status(400).json({ success: false, champ: 'heure_prevue', message: "L'heure de livraison ne peut pas être dans le passé." });
    }

    if (!produits || !Array.isArray(produits) || produits.length === 0) {
        return res.status(400).json({ success: false, champ: 'produits', message: 'Le panier est vide.' });
    }

    for (const item of produits) {
        if (!item.produit_id || !item.quantite) {
            return res.status(400).json({ success: false, message: 'Chaque produit doit avoir un produit_id et une quantite.' });
        }
        if (parseInt(item.quantite) <= 0) {
            return res.status(400).json({ success: false, message: 'La quantite doit être supérieure à 0.' });
        }
    }

    const lat = livraison_lat ? parseFloat(livraison_lat) : null;
    const lng = livraison_lng ? parseFloat(livraison_lng) : null;

    if (lat !== null && (isNaN(lat) || lat < -90 || lat > 90)) {
        return res.status(400).json({ success: false, champ: 'livraison_lat', message: 'Latitude invalide.' });
    }
    if (lng !== null && (isNaN(lng) || lng < -180 || lng > 180)) {
        return res.status(400).json({ success: false, champ: 'livraison_lng', message: 'Longitude invalide.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // ── Recalcul du total côté serveur ─────────────────────
        const ids = produits.map(p => parseInt(p.produit_id));
        const produitsResult = await client.query(
            `SELECT p.id, p.nom, p.prix, p.disponible FROM produits p WHERE p.id = ANY($1)`,
            [ids]
        );

        if (produitsResult.rows.length !== ids.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Un ou plusieurs produits sont introuvables.' });
        }

        const indisponibles = produitsResult.rows.filter(p => !p.disponible);
        if (indisponibles.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: `Ces produits ne sont plus disponibles : ${indisponibles.map(p => p.nom).join(', ')}`,
            });
        }

        const prixMap = {};
        produitsResult.rows.forEach(p => { prixMap[p.id] = p; });

        // ── Calcul du sous-total produits ──────────────────────
        let sousTotal = 0;
        const detailsProduits = produits.map(item => {
            const produit = prixMap[parseInt(item.produit_id)];
            const quantite = parseInt(item.quantite);
            const ligneTotal = parseFloat(produit.prix) * quantite;
            sousTotal += ligneTotal;
            return {
                produit_id: produit.id,
                nom: produit.nom,
                quantite,
                prix_unitaire: parseFloat(produit.prix),
                sous_total: ligneTotal,
            };
        });

        // ── DELIVERY FEE : montant total = sous-total + 200 DA ─
        const montantTotal = parseFloat((sousTotal + DELIVERY_FEE).toFixed(2));

        // ── Gestion du client par téléphone ───────────────────
        let clientId;
        const clientExistant = await client.query(
            `SELECT id FROM clients WHERE telephone = $1`,
            [telephoneNet]
        );

        if (clientExistant.rows.length > 0) {
            clientId = clientExistant.rows[0].id;
            await client.query(
                `UPDATE clients SET prenom=$1, nom=$2, email=$3, adresse_principale=$4, maj_le=NOW() WHERE id=$5`,
                [prenom.trim(), nom.trim(), email || null, adresse_livraison.trim(), clientId]
            );
        } else {
            const clientResult = await client.query(
                `INSERT INTO clients (prenom, nom, telephone, email, adresse_principale, date_premiere_commande)
                 VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id`,
                [prenom.trim(), nom.trim(), telephoneNet, email || null, adresse_livraison.trim()]
            );
            clientId = clientResult.rows[0].id;
        }

        // ── Insérer la commande avec delivery_fee ──────────────
        const commandeResult = await client.query(
            `INSERT INTO commandes
                (client_id, sous_total, delivery_fee, montant_total,
                 adresse_livraison, heure_prevue, statut, statut_paiement, instructions)
             VALUES ($1, $2, $3, $4, $5, $6, 'nouvelle', 'en_attente',  $7::text)
             RETURNING id, statut, cree_le`,
            [clientId, sousTotal, DELIVERY_FEE, montantTotal,
                adresse_livraison.trim(), heure_prevue, instructions || null]
        );

        const commande = commandeResult.rows[0];
        const commandeId = commande.id;

        // ── Insérer les détails ────────────────────────────────
        for (const item of detailsProduits) {
            await client.query(
                `INSERT INTO details_commandes (commande_id, produit_id, quantite, prix_unitaire, sous_total)
                 VALUES ($1, $2, $3, $4, $5)`,
                [commandeId, item.produit_id, item.quantite, item.prix_unitaire, item.sous_total]
            );
        }

        await client.query(
            `UPDATE clients SET nb_commandes_total=nb_commandes_total+1, date_derniere_commande=NOW() WHERE id=$1`,
            [clientId]
        );

        await client.query(
            `INSERT INTO historique_statuts (commande_id, statut, notes) VALUES ($1, 'nouvelle', 'Commande créée par le client')`,
            [commandeId]
        );

        const statsClient = await client.query(
            `SELECT COUNT(id) as nb_commandes, COALESCE(SUM(montant_total), 0) as total_depense
             FROM commandes WHERE client_id = $1`,
            [clientId]
        );

        const nbCommandes = parseInt(statsClient.rows[0].nb_commandes);
        const totalDepense = parseFloat(statsClient.rows[0].total_depense);

        await client.query('COMMIT');

        // ── Email de confirmation ──────────────────────────────
        if (email && email.trim() !== '') {
            try {
                const commandePourEmail = {
                    id: commandeId,
                    cree_le: commande.cree_le,
                    client: { prenom: prenom.trim(), nom: nom.trim(), email },
                    livraison: {
                        adresse: adresse_livraison.trim(),
                        heure_prevue,
                        instructions: instructions_livraison || null,
                    },
                    produits: detailsProduits,
                    sous_total: parseFloat(sousTotal.toFixed(2)),
                    delivery_fee: DELIVERY_FEE,
                    montant_total: montantTotal,
                };
                await envoyerConfirmationCommande(email, commandePourEmail);
            } catch (emailError) {
                console.error(`⚠️ Échec email commande ${commandeId}:`, emailError.message);
            }
        }

        // ── Socket.io : notifier les livreurs ─────────────────
        try {
            notifierNouvelleCommande({
                id: commandeId,
                adresse_livraison: adresse_livraison.trim(),
                heure_prevue,
                sous_total: parseFloat(sousTotal.toFixed(2)),
                delivery_fee: DELIVERY_FEE,
                montant_total: montantTotal,
                nb_articles: produits.reduce((acc, p) => acc + parseInt(p.quantite), 0),
                produits: detailsProduits,
                client: { prenom: prenom.trim(), nom: nom.trim(), telephone: telephoneNet },
            });
        } catch (socketErr) {
            console.warn('⚠️ Socket.io non disponible :', socketErr.message);
        }

        // ── Réponse finale ─────────────────────────────────────
        return res.status(201).json({
            success: true,
            message: 'Votre commande a bien été envoyée !',
            commande: {
                id: commandeId,
                statut: commande.statut,
                cree_le: commande.cree_le,
                client: {
                    prenom: prenom.trim(),
                    nom: nom.trim(),
                    telephone: telephoneNet,
                    email: email || null,
                    nb_commandes: nbCommandes,
                    total_depense: totalDepense,
                },
                livraison: {
                    adresse: adresse_livraison.trim(),
                    lat,
                    lng,
                    heure_prevue,
                    instructions: instructions_livraison || null,
                },
                produits: detailsProduits,
                nb_articles: produits.reduce((acc, p) => acc + parseInt(p.quantite), 0),
                // ── Détail du montant (visible par le frontend) ──
                sous_total: parseFloat(sousTotal.toFixed(2)),
                delivery_fee: DELIVERY_FEE,
                montant_total: montantTotal,
            },
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erreur creerCommande :', err.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur. Veuillez réessayer.' });
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/orders/:id
// Retourne le détail d'une commande avec delivery_fee
// ─────────────────────────────────────────────────────────────
const getCommande = async (req, res) => {
    const { id } = req.params;

    try {
        // Récupérer la commande + client
        const commandeResult = await pool.query(
            `SELECT
                cmd.id,
                cmd.statut,
                cmd.statut_paiement,
                cmd.sous_total,
                cmd.delivery_fee,
                cmd.montant_total,
                cmd.adresse_livraison,
                cmd.heure_prevue,
                cmd.cree_le,
                cmd.maj_le,
                c.prenom   AS client_prenom,
                c.nom      AS client_nom,
                c.telephone AS client_telephone,
                c.email    AS client_email
             FROM commandes cmd
             JOIN clients c ON cmd.client_id = c.id
             WHERE cmd.id = $1`,
            [id]
        );

        if (commandeResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Commande introuvable.' });
        }

        const cmd = commandeResult.rows[0];

        // Récupérer les produits de la commande
        const produitsResult = await pool.query(
            `SELECT
                dc.produit_id,
                p.nom,
                p.url_image,
                dc.quantite,
                dc.prix_unitaire,
                dc.sous_total
             FROM details_commandes dc
             JOIN produits p ON dc.produit_id = p.id
             WHERE dc.commande_id = $1`,
            [id]
        );

        return res.status(200).json({
            success: true,
            commande: {
                id: cmd.id,
                statut: cmd.statut,
                statut_paiement: cmd.statut_paiement,
                cree_le: cmd.cree_le,
                maj_le: cmd.maj_le,
                client: {
                    prenom: cmd.client_prenom,
                    nom: cmd.client_nom,
                    telephone: cmd.client_telephone,
                    email: cmd.client_email,
                },
                livraison: {
                    adresse: cmd.adresse_livraison,
                    heure_prevue: cmd.heure_prevue,
                },
                produits: produitsResult.rows,
                nb_articles: produitsResult.rows.reduce((acc, p) => acc + parseInt(p.quantite), 0),
                // ── Détail clair du montant ──
                sous_total: parseFloat(cmd.sous_total),
                delivery_fee: parseFloat(cmd.delivery_fee),
                montant_total: parseFloat(cmd.montant_total),
            },
        });

    } catch (err) {
        console.error('Erreur getCommande :', err.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

module.exports = { creerCommande, getCommande };