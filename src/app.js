// src/app.js
const express = require('express');
const path = require('path');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const clientRoutes = require('./routes/clientRoutes');
const panierRoutes = require('./routes/panierRoutes');
const commandeRoutes = require('./routes/commandeRoutes');
const livreurRoutes = require('./routes/livreurRoutes');
const adminRoutes = require('./routes/adminRoutes');
const contactRoutes = require('./routes/contactRoutes');   // ← AJOUT
require('dotenv').config();

const app = express();



app.use('/uploads', express.static(path.join(__dirname, '../uploads')));


// ── Middlewares globaux ────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);      // POST /api/auth/connexion|login
app.use('/api', clientRoutes);    // GET  /api/categories, /api/produits
app.use('/api/panier', panierRoutes);    // POST /api/panier/ajouter, etc.
app.use('/api/orders', commandeRoutes);  // POST /api/orders
app.use('/api/livreur', livreurRoutes);   // Routes espace livreur (JWT requis)
app.use('/api/admin', adminRoutes);      // GET/POST /api/admin/...
app.use('/api/contact', contactRoutes);  // POST /api/contact  ← AJOUT

// ── Route de test ─────────────────────────────────────────────
app.get('/', (req, res) => {
    res.json({ success: true, message: '🍔 BurgerTime API is running!' });
});

module.exports = app;