// src/controllers/livreurController.js
const pool = require('../config/db');
const { envoyerEmailPriseEnCharge } = require('../utils/emailService');
const { notifierCommandePrise } = require('../socket');

// ─────────────────────────────────────────────────────────────
// SCRUM-100 : GET /api/livreur/orders/new
// Retourne toutes les commandes avec statut "nouvelle"
// Accessibles à tous les livreurs connectés
// ─────────────────────────────────────────────────────────────
const getNouvellesCommandes = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
                cmd.id,
                cmd.montant_total,
                cmd.adresse_livraison,
                cmd.heure_prevue,
                cmd.statut,
                cmd.cree_le,
                cmd.instructions,
                c.prenom       AS client_prenom,
                c.nom          AS client_nom,
                c.telephone    AS client_telephone,
                -- Détails des produits
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'produit',     p.nom,
                        'quantite',    dc.quantite,
                        'prix_unitaire', dc.prix_unitaire,
                        'sous_total',  dc.sous_total
                    ) ORDER BY p.nom
                ) AS produits
             FROM commandes cmd
             JOIN clients c            ON cmd.client_id    = c.id
             JOIN details_commandes dc ON cmd.id           = dc.commande_id
             JOIN produits p           ON dc.produit_id    = p.id
             WHERE cmd.statut = 'nouvelle'
             GROUP BY cmd.id, c.prenom, c.nom, c.telephone
             ORDER BY cmd.heure_prevue ASC`,
        );

        return res.status(200).json({
            success: true,
            total: result.rows.length,
            data: result.rows,
        });

    } catch (err) {
        console.error('Erreur getNouvellesCommandes :', err.message);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur. Veuillez réessayer.',
        });
    }
};

// ─────────────────────────────────────────────────────────────
// SCRUM-101 : GET /api/livreur/orders/in-progress
// Retourne les commandes "prise" du livreur connecté
// Uniquement SES propres commandes
// ─────────────────────────────────────────────────────────────
const getCommandesEnCours = async (req, res) => {
    const livreurId = req.user.id;

    try {
        const result = await pool.query(
            `SELECT 
                cmd.id,
                cmd.montant_total,
                cmd.adresse_livraison,
                cmd.heure_prevue,
                cmd.statut,
                cmd.cree_le,
                cmd.instructions,
                c.prenom       AS client_prenom,
                c.nom          AS client_nom,
                c.telephone    AS client_telephone,
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'produit',       p.nom,
                        'quantite',      dc.quantite,
                        'prix_unitaire', dc.prix_unitaire,
                        'sous_total',    dc.sous_total
                    ) ORDER BY p.nom
                ) AS produits
             FROM commandes cmd
             JOIN clients c            ON cmd.client_id  = c.id
             JOIN details_commandes dc ON cmd.id         = dc.commande_id
             JOIN produits p           ON dc.produit_id  = p.id
             WHERE cmd.statut    = 'en_cours'
               AND cmd.livreur_id = $1
             GROUP BY cmd.id, c.prenom, c.nom, c.telephone
             ORDER BY cmd.heure_prevue ASC`,
            [livreurId]
        );

        return res.status(200).json({
            success: true,
            total: result.rows.length,
            data: result.rows,
        });

    } catch (err) {
        console.error('Erreur getCommandesEnCours :', err.message);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur. Veuillez réessayer.',
        });
    }
};

// ─────────────────────────────────────────────────────────────
// SCRUM-102 : GET /api/livreur/orders/delivered
// Retourne les commandes "livree" du livreur connecté
// Uniquement SES propres commandes livrées
// ─────────────────────────────────────────────────────────────
const getCommandesLivrees = async (req, res) => {
    const livreurId = req.user.id;

    try {
        const result = await pool.query(
            `SELECT 
                cmd.id,
                cmd.montant_total,
                cmd.adresse_livraison,
                cmd.heure_prevue,
                cmd.statut,
                cmd.cree_le,
                cmd.instructions,
                c.prenom       AS client_prenom,
                c.nom          AS client_nom,
                c.telephone    AS client_telephone,
                -- Date de livraison depuis l'historique
                hs.modifie_le  AS date_livraison,
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'produit',       p.nom,
                        'quantite',      dc.quantite,
                        'prix_unitaire', dc.prix_unitaire,
                        'sous_total',    dc.sous_total
                    ) ORDER BY p.nom
                ) AS produits
             FROM commandes cmd
             JOIN clients c            ON cmd.client_id  = c.id
             JOIN details_commandes dc ON cmd.id         = dc.commande_id
             JOIN produits p           ON dc.produit_id  = p.id
             LEFT JOIN historique_statuts hs 
                ON hs.commande_id = cmd.id 
               AND hs.statut      = 'livree'
             WHERE cmd.statut     = 'livree'
               AND cmd.livreur_id  = $1
             GROUP BY cmd.id, c.prenom, c.nom, c.telephone, hs.modifie_le
             ORDER BY hs.modifie_le DESC`,
            [livreurId]
        );

        return res.status(200).json({
            success: true,
            total: result.rows.length,
            data: result.rows,
        });

    } catch (err) {
        console.error('Erreur getCommandesLivrees :', err.message);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur. Veuillez réessayer.',
        });
    }
};

// ─────────────────────────────────────────────────────────────
// SCRUM-103 : PUT /api/livreur/orders/:id/take
// Le livreur prend en charge une commande
// Transition : "nouvelle" → "prise" + livreur_id assigné
// ─────────────────────────────────────────────────────────────
const prendreCommande = async (req, res) => {
    const { id } = req.params;
    const livreurId = req.user.id;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Vérifier que la commande existe et est bien "nouvelle"
        // FOR UPDATE → verrou pour éviter que 2 livreurs prennent la même commande
        const result = await client.query(
            `SELECT id, statut, livreur_id 
             FROM commandes 
             WHERE id = $1 
             FOR UPDATE`,
            [id]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: 'Commande introuvable.',
            });
        }

        const commande = result.rows[0];

        // 2. Vérifier que la commande est bien "nouvelle"
        if (commande.statut !== 'nouvelle') {
            await client.query('ROLLBACK');
            return res.status(409).json({
                success: false,
                message: `Cette commande ne peut pas être prise. Statut actuel : "${commande.statut}"`,
            });
        }

        // 3. Assigner le livreur et changer le statut → "prise"
        await client.query(
            `UPDATE commandes
             SET statut     = 'en_cours',
                 livreur_id = $1,
                 maj_le     = NOW()
             WHERE id = $2`,
            [livreurId, id]
        );

        // 4. Enregistrer dans l'historique
        await client.query(
            `INSERT INTO historique_statuts 
                (commande_id, statut, modifie_par, notes)
             VALUES ($1, 'en_cours', $2, 'Commande prise en charge par le livreur')`,
            [id, livreurId]
        );

        // 5. Récupérer les détails complets de la commande
        const detailsResult = await client.query(
            `SELECT 
                cmd.id,
                cmd.montant_total,
                cmd.adresse_livraison,
                cmd.heure_prevue,
                cmd.statut,
                c.prenom    AS client_prenom,
                c.nom       AS client_nom,
                c.telephone AS client_telephone,
                u.nom_complet AS livreur_nom
             FROM commandes cmd
             JOIN clients c      ON cmd.client_id  = c.id
             JOIN utilisateurs u ON cmd.livreur_id = u.id
             WHERE cmd.id = $1`,
            [id]
        );

        await client.query('COMMIT');

        const commandeData = detailsResult.rows[0];

        // ── SCRUM-104 : Envoi email asynchrone (non-bloquant) ─
        // Récupérer les produits + email client pour le template
        const produitsResult = await pool.query(
            `SELECT p.nom AS produit, dc.quantite, dc.prix_unitaire, dc.sous_total
             FROM details_commandes dc
             JOIN produits p ON dc.produit_id = p.id
             WHERE dc.commande_id = $1`,
            [id]
        );
        const clientEmailResult = await pool.query(
            `SELECT c.email, c.prenom FROM clients c
             JOIN commandes cmd ON cmd.client_id = c.id
             WHERE cmd.id = $1`,
            [id]
        );

        // Fire-and-forget : on n'attend pas la réponse de l'email
        envoyerEmailPriseEnCharge({
            clientEmail: clientEmailResult.rows[0]?.email,
            clientPrenom: clientEmailResult.rows[0]?.prenom,
            commandeId: id,
            livreurNom: commandeData.livreur_nom,
            adresseLivraison: commandeData.adresse_livraison,
            heurePrevue: commandeData.heure_prevue,
            produits: produitsResult.rows,
            montantTotal: commandeData.montant_total,
        }).catch(err => console.error('Email non-bloquant échoué :', err.message));

        // ── SCRUM-106 : Notifier les autres livreurs ──────────
        // La commande n'est plus disponible → ils doivent la retirer de leur liste
        try {
            notifierCommandePrise(parseInt(id), req.user.nom_complet);
        } catch (socketErr) {
            console.warn('⚠️  Socket.io non disponible (prise) :', socketErr.message);
        }

        return res.status(200).json({
            success: true,
            message: '✅ Commande prise en charge avec succès !',
            commande: commandeData,
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erreur prendreCommande :', err.message);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur. Veuillez réessayer.',
        });
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────
// SCRUM-105 : PUT /api/livreur/orders/:id/deliver
// Le livreur fait évoluer le statut de sa commande
// Transition 1 : "prise"    → "en_cours"  (en route)
// Transition 2 : "en_cours" → "livree"    (livrée au client)
// Règle métier MET-002 : ordre strict des statuts
// ─────────────────────────────────────────────────────────────
const livrerCommande = async (req, res) => {
    const { id } = req.params;
    const livreurId = req.user.id;
    const livreurNom = req.user.nom_complet;
    const client = await pool.connect();

    // Transitions autorisées (MET-002)
    /*const TRANSITIONS = {
        prise: { suivant: 'en_cours', label: 'En cours de livraison' },
        en_cours: { suivant: 'livree', label: 'Livrée' },
    };*/

    const TRANSITIONS = {
    nouvelle: { suivant: 'en_cours', label: 'Commencer la livraison' },
    en_cours: { suivant: 'livree', label: 'Marquer livrée' },
};

    try {
        await client.query('BEGIN');

        // 1. Récupérer la commande avec verrou (évite les race conditions)
        const result = await client.query(
            `SELECT cmd.id, cmd.statut, cmd.livreur_id,
                    cmd.montant_total, cmd.adresse_livraison, cmd.heure_prevue,
                    c.prenom AS client_prenom, c.nom AS client_nom,
                    c.telephone AS client_telephone
             FROM commandes cmd
             JOIN clients c ON cmd.client_id = c.id
             WHERE cmd.id = $1
             FOR UPDATE`,
            [id]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: 'Commande introuvable.',
            });
        }

        const commande = result.rows[0];

        // 2. Vérifier que c'est bien la commande de CE livreur
        if (commande.livreur_id !== livreurId) {
            await client.query('ROLLBACK');
            return res.status(403).json({
                success: false,
                code: 'COMMANDE_NON_ASSIGNEE',
                message: 'Vous n\'êtes pas le livreur assigné à cette commande.',
            });
        }

        // 3. Vérifier que la transition est autorisée (MET-002)
        const transition = TRANSITIONS[commande.statut];
        if (!transition) {
            await client.query('ROLLBACK');

            const messages = {
                nouvelle: 'Prenez d\'abord cette commande en charge.',
                livree: 'Cette commande a déjà été livrée.',
            };

            return res.status(409).json({
                success: false,
                code: 'TRANSITION_INVALIDE',
                message: messages[commande.statut]
                    || `Transition impossible depuis le statut "${commande.statut}".`,
                statut_actuel: commande.statut,
            });
        }

        const nouveauStatut = transition.suivant;
        const notes = `Statut mis à jour : "${commande.statut}" → "${nouveauStatut}" par ${livreurNom}`;

        // 4. Mettre à jour le statut
        /*await client.query(
            `UPDATE commandes
             SET statut = $1, maj_le = NOW()
             WHERE id   = $2`,
            [nouveauStatut, id]
        );*/

if (nouveauStatut === 'livree') {
    await client.query(
        `UPDATE commandes SET statut = $1, statut_paiement = 'paye', maj_le = NOW() WHERE id = $2`,
        [nouveauStatut, id]
    );
} else {
    await client.query(
        `UPDATE commandes SET statut = $1, maj_le = NOW() WHERE id = $2`,
        [nouveauStatut, id]
    );
}

        // 5. Enregistrer dans l'historique des statuts (GEN-008)
        await client.query(
            `INSERT INTO historique_statuts (commande_id, statut, modifie_par, notes)
             VALUES ($1, $2, $3, $4)`,
            [id, nouveauStatut, livreurId, notes]
        );

        // 6. Si livraison finale → émettre événement Socket.io (SCRUM-106)
        if (nouveauStatut === 'livree') {
            try {
                const io = req.app.get('socketio');
                if (io) {
                    // Notifier l'admin que la commande est livrée
                    io.to('room:admins').emit('commande:livree', {
                        commandeId: parseInt(id),
                        livreurId,
                        livreurNom,
                        clientPrenom: commande.client_prenom,
                        clientNom: commande.client_nom,
                        montant: commande.montant_total,
                        livreeA: new Date().toISOString(),
                    });
                }
            } catch (socketErr) {
                console.warn('⚠️  Socket.io non disponible (livraison) :', socketErr.message);
            }
        }

        await client.query('COMMIT');

        // 7. Construire la réponse selon la transition
        const messageParStatut = {
            en_cours: '🚴 Livraison en cours ! En route vers le client.',
            livree: '🎉 Commande livrée avec succès !',
        };

        return res.status(200).json({
            success: true,
            message: messageParStatut[nouveauStatut],
            statut_avant: commande.statut,
            statut_apres: nouveauStatut,
            commande: {
                id: parseInt(id),
                statut: nouveauStatut,
                adresse_livraison: commande.adresse_livraison,
                heure_prevue: commande.heure_prevue,
                montant_total: commande.montant_total,
                client: {
                    prenom: commande.client_prenom,
                    nom: commande.client_nom,
                    telephone: commande.client_telephone,
                },
                mis_a_jour_le: new Date().toISOString(),
            },
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erreur livrerCommande :', err.message);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur. Veuillez réessayer.',
        });
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────
// NOUVEAU : PUT /api/livreur/orders/:id/abandon
// Le livreur abandonne une commande qu'il avait prise
// Transition : "prise" → "abandonnee"
// Champs requis : { abandon_reason }
// ─────────────────────────────────────────────────────────────
const abandonnerCommande = async (req, res) => {
    const { id } = req.params;
    const { abandon_reason } = req.body;
    const livreurId = req.user.id;
    const livreurNom = req.user.nom_complet;
    const client = await pool.connect();

    if (!abandon_reason || abandon_reason.trim() === '') {
        return res.status(400).json({
            success: false,
            champ: 'abandon_reason',
            message: 'Le motif d\'abandon est obligatoire.',
        });
    }

    try {
        await client.query('BEGIN');

        const result = await client.query(
            `SELECT cmd.id, cmd.statut, cmd.livreur_id,
                    c.prenom AS client_prenom, c.nom AS client_nom
             FROM commandes cmd
             JOIN clients c ON cmd.client_id = c.id
             WHERE cmd.id = $1 FOR UPDATE`,
            [id]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Commande introuvable.' });
        }

        const commande = result.rows[0];

        if (commande.livreur_id !== livreurId) {
            await client.query('ROLLBACK');
            return res.status(403).json({ success: false, message: 'Vous n\'êtes pas le livreur assigné à cette commande.' });
        }

        if (commande.statut !== 'en_cours') {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: `Impossible d'abandonner une commande avec le statut "${commande.statut}".` });
        }

        await client.query(
            `UPDATE commandes
             SET statut         = 'abandonnee',
                 abandon_reason = $1,
                 abandoned_at   = NOW(),
                 archived       = true,
                 livreur_id     = NULL,
                 maj_le         = NOW()
             WHERE id = $2`,
            [abandon_reason.trim(), id]
        );

        await client.query(
            `INSERT INTO historique_statuts (commande_id, statut, modifie_par, notes)
             VALUES ($1, 'abandonnee', $2, $3)`,
            [id, livreurId, `Abandonné par ${livreurNom} — Motif : ${abandon_reason.trim()}`]
        );

        await client.query('COMMIT');

        return res.status(200).json({
            success: true,
            message: 'Commande abandonnée avec succès.',
            commande: {
                id: parseInt(id),
                statut: 'abandonnee',
                abandon_reason: abandon_reason.trim(),
                abandoned_at: new Date().toISOString(),
                client: `${commande.client_prenom} ${commande.client_nom}`,
            },
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erreur abandonnerCommande :', err.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur. Veuillez réessayer.' });
    } finally {
        client.release();
    }
};

module.exports = {
    getNouvellesCommandes,
    getCommandesEnCours,
    getCommandesLivrees,
    prendreCommande,
    livrerCommande,
    abandonnerCommande,
};
