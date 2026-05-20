// src/controllers/adminController.js
const pool = require('../config/db');
const path = require('path');

// ─────────────────────────────────────────────────────────────
// SCRUM-151 : GET /api/admin/dashboard
// Retourne { today, week, month, total_revenue }
// ─────────────────────────────────────────────────────────────
const getDashboard = async (req, res) => {
    try {
        const [today, week, month, revenue] = await Promise.all([

            // Commandes aujourd'hui
            pool.query(`
                SELECT COUNT(*) AS count
                FROM commandes
                WHERE DATE(cree_le) = CURRENT_DATE
                  AND statut != 'annulee'
            `),

            // Commandes cette semaine
            pool.query(`
                SELECT COUNT(*) AS count
                FROM commandes
                WHERE cree_le >= DATE_TRUNC('week', NOW())
                  AND statut != 'annulee'
            `),

            // Commandes ce mois
            pool.query(`
                SELECT COUNT(*) AS count
                FROM commandes
                WHERE cree_le >= DATE_TRUNC('month', NOW())
                  AND statut != 'annulee'
            `),

            // Chiffre d'affaires total
            pool.query(`
                SELECT 
                    COALESCE(SUM(CASE WHEN DATE(cree_le) = CURRENT_DATE          THEN montant_total END), 0) AS today,
                    COALESCE(SUM(CASE WHEN cree_le >= DATE_TRUNC('week',  NOW())  THEN montant_total END), 0) AS week,
                    COALESCE(SUM(CASE WHEN cree_le >= DATE_TRUNC('month', NOW())  THEN montant_total END), 0) AS month,
                    COALESCE(SUM(montant_total), 0) AS total
                FROM commandes
                WHERE statut = 'livree'
            `),
        ]);

        return res.status(200).json({
            success: true,
            data: {
                commandes: {
                    today: parseInt(today.rows[0].count),
                    week: parseInt(week.rows[0].count),
                    month: parseInt(month.rows[0].count),
                },
                total_revenue: {
                    today: parseFloat(revenue.rows[0].today),
                    week: parseFloat(revenue.rows[0].week),
                    month: parseFloat(revenue.rows[0].month),
                    total: parseFloat(revenue.rows[0].total),
                },
            },
        });

    } catch (err) {
        console.error('Erreur getDashboard :', err.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

// ─────────────────────────────────────────────────────────────
// SCRUM-152 : GET /api/admin/dashboard/status
// Retourne { nouvelle, prise, en_cours, livree, annulee }
// COUNT(CASE WHEN statut = 'prise'     THEN 1 END) AS prise,

// ─────────────────────────────────────────────────────────────
const getDashboardStatus = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                COUNT(CASE WHEN statut = 'nouvelle'  THEN 1 END) AS nouvelle,
                COUNT(CASE WHEN statut = 'en_cours'  THEN 1 END) AS en_cours,
                COUNT(CASE WHEN statut = 'livree'    THEN 1 END) AS livree,
                COUNT(CASE WHEN statut = 'annulee'   THEN 1 END) AS annulee,
                COUNT(*)                                          AS total
            FROM commandes
            WHERE DATE(cree_le) = CURRENT_DATE
        `);

        const stats = result.rows[0];

        return res.status(200).json({
            success: true,
            data: {
                nouvelle: parseInt(stats.nouvelle),
                prise: parseInt(stats.prise),
                en_cours: parseInt(stats.en_cours),
                livree: parseInt(stats.livree),
                annulee: parseInt(stats.annulee),
                total: parseInt(stats.total),
            },
        });

    } catch (err) {
        console.error('Erreur getDashboardStatus :', err.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

// ─────────────────────────────────────────────────────────────
// SCRUM-153 : GET /api/admin/orders/weekly
// Retourne [{ jour, count }] pour les 7 derniers jours
// ─────────────────────────────────────────────────────────────
const getOrdersWeekly = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                TO_CHAR(DATE_TRUNC('day', cree_le), 'DD/MM') AS jour,
                COUNT(*) AS count
            FROM commandes
            WHERE cree_le >= NOW() - INTERVAL '7 days'
              AND statut != 'annulee'
            GROUP BY DATE_TRUNC('day', cree_le)
            ORDER BY DATE_TRUNC('day', cree_le) ASC
        `);

        return res.status(200).json({
            success: true,
            data: result.rows.map(r => ({
                jour: r.jour,
                count: parseInt(r.count),
            })),
        });

    } catch (err) {
        console.error('Erreur getOrdersWeekly :', err.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

// ─────────────────────────────────────────────────────────────
// SCRUM-154 : GET /api/admin/orders/status-stats
// Retourne [{ status, count, percentage }]
// ─────────────────────────────────────────────────────────────
const getOrdersStatusStats = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                statut                                              AS status,
                COUNT(*)                                            AS count,
                ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS percentage
            FROM commandes
            GROUP BY statut
            ORDER BY count DESC
        `);

        return res.status(200).json({
            success: true,
            data: result.rows.map(r => ({
                status: r.status,
                count: parseInt(r.count),
                percentage: parseFloat(r.percentage),
            })),
        });

    } catch (err) {
        console.error('Erreur getOrdersStatusStats :', err.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

// ─────────────────────────────────────────────────────────────
// SCRUM-155 : GET /api/admin/products/top-selling
// Retourne top 5 [{ name, units_sold, revenue }]
// ─────────────────────────────────────────────────────────────
const getTopSellingProducts = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                p.nom              AS name,
                SUM(dc.quantite)   AS units_sold,
                SUM(dc.sous_total) AS revenue
            FROM details_commandes dc
            JOIN produits p    ON dc.produit_id  = p.id
            JOIN commandes cmd ON dc.commande_id = cmd.id
            WHERE cmd.statut = 'livree'
            GROUP BY p.id, p.nom
            ORDER BY units_sold DESC
            LIMIT 5
        `);

        return res.status(200).json({
            success: true,
            data: result.rows.map(r => ({
                name: r.name,
                units_sold: parseInt(r.units_sold),
                revenue: parseFloat(r.revenue),
            })),
        });

    } catch (err) {
        console.error('Erreur getTopSellingProducts :', err.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

// ─────────────────────────────────────────────────────────────
// SCRUM-156 : GET /api/admin/orders/period-stats
// Retourne { today, week, month, year }
// ─────────────────────────────────────────────────────────────
const getOrdersPeriodStats = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                -- Aujourd'hui
                COUNT(CASE WHEN DATE(cree_le) = CURRENT_DATE                    THEN 1 END) AS today_count,
                COALESCE(SUM(CASE WHEN DATE(cree_le) = CURRENT_DATE             THEN montant_total END), 0) AS today_revenue,

                -- Cette semaine
                COUNT(CASE WHEN cree_le >= DATE_TRUNC('week',  NOW())           THEN 1 END) AS week_count,
                COALESCE(SUM(CASE WHEN cree_le >= DATE_TRUNC('week',  NOW())    THEN montant_total END), 0) AS week_revenue,

                -- Ce mois
                COUNT(CASE WHEN cree_le >= DATE_TRUNC('month', NOW())           THEN 1 END) AS month_count,
                COALESCE(SUM(CASE WHEN cree_le >= DATE_TRUNC('month', NOW())    THEN montant_total END), 0) AS month_revenue,

                -- Cette année
                COUNT(CASE WHEN cree_le >= DATE_TRUNC('year',  NOW())           THEN 1 END) AS year_count,
                COALESCE(SUM(CASE WHEN cree_le >= DATE_TRUNC('year',  NOW())    THEN montant_total END), 0) AS year_revenue
            FROM commandes
            WHERE statut != 'annulee'
        `);

        const s = result.rows[0];

        return res.status(200).json({
            success: true,
            data: {
                today: {
                    commandes: parseInt(s.today_count),
                    revenue: parseFloat(s.today_revenue),
                },
                week: {
                    commandes: parseInt(s.week_count),
                    revenue: parseFloat(s.week_revenue),
                },
                month: {
                    commandes: parseInt(s.month_count),
                    revenue: parseFloat(s.month_revenue),
                },
                year: {
                    commandes: parseInt(s.year_count),
                    revenue: parseFloat(s.year_revenue),
                },
            },
        });

    } catch (err) {
        console.error('Erreur getOrdersPeriodStats :', err.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

// ─────────────────────────────────────────────────────────────
// SCRUM-157 : GET /api/admin/users/livreurs
// Retourne la liste des livreurs
// ─────────────────────────────────────────────────────────────
/*const getLivreurs = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id, nom_complet, email, telephone,
                actif, derniere_connexion, cree_le
            FROM utilisateurs
            WHERE role = 'livreur'
            ORDER BY cree_le DESC
        `);

        return res.status(200).json({
            success: true,
            total: result.rows.length,
            data: result.rows,
        });

    } catch (err) {
        console.error('Erreur getLivreurs :', err.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};*/

const getLivreurs = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                u.id, 
                u.nom_complet, 
                u.email, 
                u.telephone,
                u.actif, 
                u.derniere_connexion, 
                u.cree_le,
                COUNT(c.id) AS commandes_livrees
            FROM utilisateurs u
            LEFT JOIN commandes c ON c.livreur_id = u.id AND c.statut = 'livree'
            WHERE u.role = 'livreur'
            GROUP BY u.id, u.nom_complet, u.email, u.telephone, u.actif, u.derniere_connexion, u.cree_le
            ORDER BY u.cree_le DESC
        `);

        return res.status(200).json({
            success: true,
            total: result.rows.length,
            data: result.rows.map(row => ({
                ...row,
                commandes_livrees: parseInt(row.commandes_livrees) || 0
            })),
        });

    } catch (err) {
        console.error('Erreur getLivreurs :', err.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

// ─────────────────────────────────────────────────────────────
// SCRUM-158 : POST /api/admin/users/livreurs
// Ajouter un livreur (hash mot de passe)
// ─────────────────────────────────────────────────────────────
const addLivreur = async (req, res) => {
    const { nom_complet, email, telephone, mot_de_passe } = req.body;

    if (!nom_complet || !email || !mot_de_passe) {
        return res.status(400).json({
            success: false,
            message: 'nom_complet, email et mot_de_passe sont obligatoires.',
        });
    }

    try {
        const bcrypt = require('bcrypt');
        const hash = await bcrypt.hash(mot_de_passe, 12);

        const result = await pool.query(`
            INSERT INTO utilisateurs (nom_complet, email, telephone, role, mot_de_passe_hash, actif)
            VALUES ($1, $2, $3, 'livreur', $4, true)
            RETURNING id, nom_complet, email, telephone, role, actif, cree_le
        `, [nom_complet, email, telephone || null, hash]);

        return res.status(201).json({
            success: true,
            message: `Livreur "${nom_complet}" créé avec succès.`,
            data: result.rows[0],
        });

    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({
                success: false,
                message: 'Cet email est déjà utilisé.',
            });
        }
        console.error('Erreur addLivreur :', err.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

// ─────────────────────────────────────────────────────────────
// SCRUM-159 : PUT /api/admin/users/livreurs/:id
// Modifier un livreur
// ─────────────────────────────────────────────────────────────
const updateLivreur = async (req, res) => {
    const { id } = req.params;
    const { nom_complet, email, telephone, actif } = req.body;

    try {
        const result = await pool.query(`
            UPDATE utilisateurs
            SET nom_complet = COALESCE($1, nom_complet),
                email       = COALESCE($2, email),
                telephone   = COALESCE($3, telephone),
                actif       = COALESCE($4, actif),
                maj_le      = NOW()
            WHERE id = $5 AND role = 'livreur'
            RETURNING id, nom_complet, email, telephone, actif
        `, [nom_complet, email, telephone, actif, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Livreur introuvable.' });
        }

        return res.status(200).json({
            success: true,
            message: 'Livreur mis à jour avec succès.',
            data: result.rows[0],
        });

    } catch (err) {
        console.error('Erreur updateLivreur :', err.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

// ─────────────────────────────────────────────────────────────
// SCRUM-160 : DELETE /api/admin/users/livreurs/:id
// Supprimer un livreur
// ─────────────────────────────────────────────────────────────
const deleteLivreur = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(`
            DELETE FROM utilisateurs
            WHERE id = $1 AND role = 'livreur'
            RETURNING id, nom_complet
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Livreur introuvable.' });
        }

        return res.status(200).json({
            success: true,
            message: `Livreur "${result.rows[0].nom_complet}" supprimé avec succès.`,
        });

    } catch (err) {
        console.error('Erreur deleteLivreur :', err.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

// ─────────────────────────────────────────────────────────────
// SCRUM-161 : GET /api/admin/products
// Retourner les catégories
const getCategories = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, nom, description, ordre_affichage
            FROM categories
            ORDER BY ordre_affichage
        `);

        return res.status(200).json({
            success: true,
            data: result.rows,
        });

    } catch (err) {
        console.error('Erreur getCategories :', err.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};


// Retourne liste des produits (filtre catégorie optionnel)
// ─────────────────────────────────────────────────────────────
const getProducts = async (req, res) => {
    const { categorie_id } = req.query;

    try {
        let query = `
            SELECT
                p.id, p.nom, p.description, p.prix,
                p.disponible, p.url_image, p.cree_le, p.categorie_id,
                c.nom AS categorie
            FROM produits p
            JOIN categories c ON p.categorie_id = c.id
        `;
        const params = [];

        if (categorie_id) {
            params.push(parseInt(categorie_id));
            query += ` WHERE p.categorie_id = $${params.length}`;
        }

        query += ` ORDER BY p.cree_le DESC`;

        const result = await pool.query(query, params);

        return res.status(200).json({
            success: true,
            total: result.rows.length,
            data: result.rows,
        });

    } catch (err) {
        console.error('Erreur getProducts :', err.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

// ─────────────────────────────────────────────────────────────
// SCRUM-162 : POST /api/admin/products
// Ajouter un produit avec upload photo
// ─────────────────────────────────────────────────────────────
const addProduct = async (req, res) => {
    const { nom, description, prix, categorie_id, disponible } = req.body;

    if (!nom || !prix || !categorie_id) {
        return res.status(400).json({
            success: false,
            message: 'nom, prix et categorie_id sont obligatoires.',
        });
    }

    const url_image = req.file ? `/uploads/${req.file.filename}` : null;

    try {
        const result = await pool.query(`
            INSERT INTO produits (nom, description, prix, categorie_id, url_image, disponible)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [nom, description || null, prix, categorie_id, url_image, disponible ?? true]);

        return res.status(201).json({
            success: true,
            message: `Produit "${nom}" ajouté avec succès.`,
            data: result.rows[0],
        });

    } catch (err) {
        console.error('Erreur addProduct :', err.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

// ─────────────────────────────────────────────────────────────
// SCRUM-163 : PUT /api/admin/products/:id
// Modifier un produit avec photo optionnelle
// ─────────────────────────────────────────────────────────────
const updateProduct = async (req, res) => {
    const { id } = req.params;
    const { nom, prix, categorie_id, description, disponible } = req.body;

    const url_image = req.file ? `/uploads/${req.file.filename}` : undefined;

    console.log("BODY =", req.body);
    console.log("FILE =", req.file);
    console.log("ID =", req.params.id);

    try {
        const result = await pool.query(`
            UPDATE produits
            SET nom          = COALESCE($1, nom),
                description  = COALESCE($2, description),
                prix         = COALESCE($3, prix),
                categorie_id = COALESCE($4, categorie_id),
                disponible   = COALESCE($5, disponible),
                url_image    = COALESCE($6, url_image),
                maj_le       = NOW()
            WHERE id = $7
            RETURNING *
        `, [nom, description, prix, categorie_id, disponible, url_image, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Produit introuvable.' });
        }

        return res.status(200).json({
            success: true,
            message: 'Produit mis à jour avec succès.',
            data: result.rows[0],
        });

    } catch (err) {
        console.error('Erreur updateProduct :', err.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

// ─────────────────────────────────────────────────────────────
// SCRUM-164 : DELETE /api/admin/products/:id
// Supprimer un produit (+ supprimer la photo)
// ─────────────────────────────────────────────────────────────
const deleteProduct = async (req, res) => {
    const { id } = req.params;
    const fs = require('fs');

    try {
        // 1. Récupérer le produit pour avoir l'URL de la photo
        const produit = await pool.query(
            `SELECT id, nom, url_image FROM produits WHERE id = $1`,
            [id]
        );

        if (produit.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Produit introuvable.' });
        }

        // 2. Supprimer le produit
        await pool.query(`DELETE FROM produits WHERE id = $1`, [id]);

        // 3. Supprimer la photo si elle existe
        if (produit.rows[0].url_image) {
            const filePath = path.join(__dirname, '../../', produit.rows[0].url_image);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        return res.status(200).json({
            success: true,
            message: `Produit "${produit.rows[0].nom}" supprimé avec succès.`,
        });

    } catch (err) {
        console.error('Erreur deleteProduct :', err.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

// ─────────────────────────────────────────────────────────────
// SCRUM-165 : POST /api/admin/logout
// Déconnexion admin
// ─────────────────────────────────────────────────────────────
const logout = async (req, res) => {
    return res.status(200).json({
        success: true,
        message: 'Déconnexion réussie. Supprimez le token côté frontend.',
    });
};


// ─────────────────────────────────────────────────────────────
// NOUVEAU : GET /api/admin/orders/archived
// Retourne toutes les commandes abandonnées (archivées)
// ─────────────────────────────────────────────────────────────
const getCommandesArchivees = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                cmd.id,
                cmd.montant_total,
                cmd.adresse_livraison,
                cmd.heure_prevue,
                cmd.statut,
                cmd.abandon_reason,
                cmd.abandoned_at,
                cmd.cree_le,
                c.prenom       AS client_prenom,
                c.nom          AS client_nom,
                c.telephone    AS client_telephone,
                u.nom_complet  AS livreur_nom,
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'produit',       p.nom,
                        'quantite',      dc.quantite,
                        'prix_unitaire', dc.prix_unitaire,
                        'sous_total',    dc.sous_total
                    ) ORDER BY p.nom
                ) AS produits
            FROM commandes cmd
            JOIN clients c             ON cmd.client_id   = c.id
            JOIN details_commandes dc  ON cmd.id          = dc.commande_id
            JOIN produits p            ON dc.produit_id   = p.id
            LEFT JOIN utilisateurs u   ON cmd.livreur_id  = u.id
            WHERE cmd.archived = true
            GROUP BY cmd.id, c.prenom, c.nom, c.telephone, u.nom_complet
            ORDER BY cmd.abandoned_at DESC
        `);

        return res.status(200).json({
            success: true,
            total: result.rows.length,
            data: result.rows,
        });

    } catch (err) {
        console.error('Erreur getCommandesArchivees :', err.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur. Veuillez réessayer.' });
    }
};


// ─────────────────────────────────────────────────────────────
// GET /api/admin/orders/abandons
// Retourne toutes les commandes abandonnées
// ─────────────────────────────────────────────────────────────
const getCommandesAbandonnees = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                cmd.id,
                cmd.montant_total        AS montant,
                cmd.abandon_reason       AS motif,
                cmd.abandoned_at         AS abandon_le,
                cmd.adresse_livraison,
                cmd.cree_le,
                c.prenom                 AS client_prenom,
                c.nom                    AS client_nom,
                c.telephone              AS client_telephone
            FROM commandes cmd
            JOIN clients c ON cmd.client_id = c.id
            WHERE cmd.statut = 'abandonnee'
            ORDER BY cmd.abandoned_at DESC
        `);

        return res.status(200).json({
            success: true,
            total:   result.rows.length,
            data:    result.rows.map(r => ({
                id:         r.id,
                montant:    parseFloat(r.montant),
                motif:      r.motif || 'Non spécifié',
                abandon_le: r.abandon_le,
                adresse_livraison: r.adresse_livraison,
                cree_le:    r.cree_le,
                client: {
                    prenom:    r.client_prenom,
                    nom:       r.client_nom,
                    telephone: r.client_telephone,
                },
            })),
        });

    } catch (err) {
        console.error('Erreur getCommandesAbandonnees :', err.message);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur. Veuillez réessayer.',
        });
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/admin/orders/abandons/stats
// Retourne les statistiques des abandons
// ─────────────────────────────────────────────────────────────
const getStatsAbandons = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                COUNT(*)                          AS total_abandons,
                COALESCE(SUM(montant_total), 0)   AS montant_total_perdu,
                COALESCE(AVG(montant_total), 0)   AS moyenne_par_abandon
            FROM commandes
            WHERE statut = 'abandonnee'
        `);

        const s = result.rows[0];

        return res.status(200).json({
            success: true,
            data: {
                total_abandons:      parseInt(s.total_abandons),
                montant_total_perdu: parseFloat(s.montant_total_perdu),
                moyenne_par_abandon: parseFloat(parseFloat(s.moyenne_par_abandon).toFixed(2)),
            },
        });

    } catch (err) {
        console.error('Erreur getStatsAbandons :', err.message);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur. Veuillez réessayer.',
        });
    }
};



const getRecentOrders = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        cmd.id,
        cmd.montant_total,
        cmd.statut,
        cmd.cree_le,
        c.prenom AS client_prenom,
        c.nom AS client_nom
      FROM commandes cmd
      JOIN clients c ON cmd.client_id = c.id
      ORDER BY cmd.cree_le DESC
      LIMIT 10
    `);

    return res.status(200).json({
      success: true,
      data: result.rows,
    });

  } catch (err) {
    console.error('Erreur getRecentOrders:', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }


 
};

 const getAllCommandes = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                cmd.id,
                cmd.montant_total,
                cmd.statut,
                cmd.cree_le,
                c.prenom AS client_prenom,
                c.nom AS client_nom,
                u.nom_complet AS livreur_nom
            FROM commandes cmd
            JOIN clients c ON cmd.client_id = c.id
            LEFT JOIN utilisateurs u ON cmd.livreur_id = u.id
            ORDER BY cmd.cree_le DESC
        `);

        return res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (err) {
        console.error('Erreur getAllCommandes:', err);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }



};

const getCommandeDetails = async (req, res) => {
const { id } = req.params;
    
    try {
        // Récupérer la commande et le client
        const commandeResult = await pool.query(`
            SELECT 
                cmd.id,
                cmd.montant_total,
                cmd.statut,
                cmd.cree_le,
                cmd.adresse_livraison,
                cmd.heure_prevue,
                cmd.instructions,
                c.prenom AS client_prenom,
                c.nom AS client_nom,
                c.telephone AS client_telephone,
                c.email AS client_email,
                u.nom_complet AS livreur_nom
            FROM commandes cmd
            JOIN clients c ON cmd.client_id = c.id
            LEFT JOIN utilisateurs u ON cmd.livreur_id = u.id
            WHERE cmd.id = $1
        `, [id]);

        if (commandeResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Commande introuvable.' });
        }

        // Récupérer les produits de la commande
        const produitsResult = await pool.query(`
            SELECT 
                p.nom AS produit,
                dc.quantite,
                dc.prix_unitaire,
                dc.sous_total
            FROM details_commandes dc
            JOIN produits p ON dc.produit_id = p.id
            WHERE dc.commande_id = $1
        `, [id]);

        return res.status(200).json({
            success: true,
            commande: commandeResult.rows[0],
            produits: produitsResult.rows
        });
        
    } catch (err) {
        console.error('Erreur getCommandeDetails:', err);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};
console.log("EXPORT TEST", typeof getCommandeDetails);

module.exports = {
    getDashboard,
    getDashboardStatus,
    getOrdersWeekly,
    getOrdersStatusStats,
    getTopSellingProducts,
    getOrdersPeriodStats,
    getLivreurs,
    addLivreur,
    
    updateLivreur,
    deleteLivreur,
    getCategories,
    getProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    logout,
    getCommandesArchivees,
    getCommandesAbandonnees,  
    getStatsAbandons,         
    getRecentOrders,
    getAllCommandes,
    getCommandeDetails,
    
};
