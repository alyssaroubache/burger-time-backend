// src/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const upload = require('../config/multer');
const { protect, isAdmin } = require('../middlewares/auth');
const {
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
    getCommandeDetails

} = require('../controllers/adminController');

// ── Toutes les routes admin nécessitent une authentification admin ──
router.use(protect, isAdmin);

// ── Dashboard ──────────────────────────────────────────────────────
router.get('/dashboard', getDashboard);        // SCRUM-151
router.get('/dashboard/status', getDashboardStatus);  // SCRUM-152

// ── Statistiques commandes ─────────────────────────────────────────
router.get('/orders/weekly', getOrdersWeekly);      // SCRUM-153
router.get('/orders/status-stats', getOrdersStatusStats); // SCRUM-154
router.get('/orders/period-stats', getOrdersPeriodStats); // SCRUM-156

// ── Produits top ───────────────────────────────────────────────────
router.get('/products/top-selling', getTopSellingProducts); // SCRUM-155

// ── Gestion livreurs ───────────────────────────────────────────────
router.get('/users/livreurs', getLivreurs);           // SCRUM-157
router.post('/users/livreurs', addLivreur);            // SCRUM-158
router.put('/users/livreurs/:id', updateLivreur);         // SCRUM-159
router.delete('/users/livreurs/:id', deleteLivreur);         // SCRUM-160

// ── Gestion produits ───────────────────────────────────────────────
router.get('/categories', getCategories);
router.get('/products', getProducts);                        // SCRUM-161
router.post('/products', upload.single('image'), addProduct);  // SCRUM-162
router.put('/products/:id', upload.single('image'), updateProduct);// SCRUM-163
router.delete('/products/:id', deleteProduct);                       // SCRUM-164

// ── Déconnexion ────────────────────────────────────────────────────
router.post('/logout', logout); // SCRUM-165

router.get('/orders/archived', getCommandesArchivees);
router.get('/orders/abandons',       getCommandesAbandonnees); // ← NOUVEAU
router.get('/orders/abandons/stats', getStatsAbandons);        // ← NOUVEAU
router.get('/orders/recent', getRecentOrders);
router.get('/orders/all', getAllCommandes);
router.get('/orders/:id', getCommandeDetails);


module.exports = router;
