// src/socket/index.js
// ─────────────────────────────────────────────────────────────
// SCRUM-106 : WebSocket Socket.io
// Notifications temps réel pour l'espace livreur
//
// ARCHITECTURE DES ROOMS :
//   room:livreurs   → tous les livreurs connectés
//   room:admins     → tous les admins connectés
//   livreur:{id}    → un livreur spécifique
//
// EVENTS ÉMIS PAR LE SERVEUR :
//   commande:nouvelle   → nouvelle commande disponible (→ livreurs)
//   commande:prise      → commande prise par un livreur (→ livreurs)
//   commande:en_cours   → livreur en route (→ admins)
//   commande:livree     → commande finalisée (→ admins)
//   ping:pong           → keepalive
//
// EVENTS REÇUS DU CLIENT :
//   livreur:join        → livreur rejoint sa room
//   admin:join          → admin rejoint sa room
// ─────────────────────────────────────────────────────────────
const { envoyerEmailNouvelleCommande } = require('../services/emailService');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

let io;

// ── Middleware d'authentification Socket.io ────────────────────
// Vérifie le token JWT à la connexion (comme le middleware HTTP)
const authenticateSocket = async (socket, next) => {
    try {
        const token =
            socket.handshake.auth?.token ||
            socket.handshake.headers?.authorization?.replace('Bearer ', '');

        if (!token) {
            // Connexion sans token autorisée → rôle "guest" (lecture publique)
            socket.data.user = { role: 'guest' };
            return next();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const result = await pool.query(
            `SELECT id, nom_complet, email, role, actif
             FROM utilisateurs WHERE id = $1`,
            [decoded.id]
        );

        const user = result.rows[0];

        if (!user || !user.actif) {
            socket.data.user = { role: 'guest' };
            return next();
        }

        socket.data.user = {
            id: user.id,
            nom: user.nom_complet,
            email: user.email,
            role: user.role,
        };

        next();

    } catch (err) {
        // Token invalide/expiré → on connecte en guest (pas d'erreur fatale)
        console.warn('⚠️  Socket auth warning :', err.message);
        socket.data.user = { role: 'guest' };
        next();
    }
};

// ── Initialisation Socket.io ───────────────────────────────────
const initSocket = (server) => {
    io = socketIo(server, {
        cors: {
            origin: process.env.CORS_ORIGIN || '*',
            methods: ['GET', 'POST'],
        },
        pingTimeout: 60000,  // 60s avant déconnexion
        pingInterval: 25000,  // keepalive toutes les 25s
    });

    // Appliquer le middleware d'auth sur toutes les connexions
    io.use(authenticateSocket);

    io.on('connection', (socket) => {
        const user = socket.data.user;

        console.log(`🔌 Socket connecté | ID: ${socket.id} | Rôle: ${user.role} | Nom: ${user.nom || 'guest'}`);

        // ── Auto-join des rooms selon le rôle ─────────────────
        if (user.role === 'livreur') {
            socket.join('room:livreurs');
            socket.join(`livreur:${user.id}`);
            console.log(`🚴 Livreur "${user.nom}" → room:livreurs + livreur:${user.id}`);

            // Confirmer la connexion au livreur
            socket.emit('connected', {
                message: `Bienvenue ${user.nom} ! Vous recevrez les nouvelles commandes en temps réel.`,
                role: 'livreur',
                rooms: ['room:livreurs', `livreur:${user.id}`],
            });
        }

        if (user.role === 'admin') {
            socket.join('room:admins');
            console.log(`🛡️  Admin "${user.nom}" → room:admins`);

            socket.emit('connected', {
                message: `Tableau de bord connecté, ${user.nom}.`,
                role: 'admin',
                rooms: ['room:admins'],
            });
        }

        // ── Event : livreur:join (join manuel si besoin) ──────
        socket.on('livreur:join', (data) => {
            if (user.role === 'livreur') {
                socket.join('room:livreurs');
                socket.emit('livreur:joined', { success: true });
                console.log(`🚴 livreur:join manuel — ${user.nom}`);
            }
        });

        // ── Event : admin:join (join manuel si besoin) ────────
        socket.on('admin:join', () => {
            if (user.role === 'admin') {
                socket.join('room:admins');
                socket.emit('admin:joined', { success: true });
            }
        });

        // ── Keepalive ping/pong ────────────────────────────────
        socket.on('ping:pong', () => {
            socket.emit('ping:pong', { ts: Date.now() });
        });

        // ── Déconnexion ────────────────────────────────────────
        socket.on('disconnect', (reason) => {
            console.log(`🔌 Socket déconnecté | ID: ${socket.id} | Raison: ${reason}`);
        });
    });

    console.log('✅ Socket.io initialisé avec rooms livreurs/admins');
    return io;
};

// ── Getters / Helpers exportés ─────────────────────────────────

/**
 * Retourne l'instance io (lève une erreur si non initialisée)
 */
const getIo = () => {
    if (!io) throw new Error('Socket.io non initialisé — appelez initSocket() d\'abord.');
    return io;
};

/**
 * SCRUM-106 : Notifie tous les livreurs connectés d'une nouvelle commande.
 * Appelé depuis commandeController après création d'une commande.
 * @param {Object} commande - données de la nouvelle commande
 */
const notifierNouvelleCommande = async (commande) => {
    if (!io) return;
    
    // 1. Envoyer la notification WebSocket
    io.to('room:livreurs').emit('commande:nouvelle', {
        event: 'commande:nouvelle',
        commandeId: commande.id,
        client: commande.client,
        adresse: commande.adresse_livraison,
        montant: commande.montant_total,
        heurePrevue: commande.heure_prevue,
        nbArticles: commande.nb_articles,
        produits: commande.produits,
        timestamp: new Date().toISOString(),
    });
    
    // 2. Récupérer les emails des livreurs actifs
    try {
        const livreurs = await pool.query(
            `SELECT email, nom_complet FROM utilisateurs WHERE role = 'livreur' AND actif = true`
        );
        
        // 3. Envoyer un email à chaque livreur
        for (const livreur of livreurs.rows) {
            await envoyerEmailNouvelleCommande(livreur.email, commande, livreur.nom_complet);
        }
        console.log(`📧 Email envoyé aux ${livreurs.rows.length} livreurs pour la commande #${commande.id}`);
    } catch (err) {
        console.error('❌ Erreur envoi email aux livreurs:', err.message);
    }
    
    console.log(`📡 commande:nouvelle émis → room:livreurs | Commande #${commande.id}`);
};

/**
 * Notifie tous les livreurs qu'une commande vient d'être prise.
 * Ils doivent la retirer de leur liste.
 * @param {number} commandeId
 * @param {string} livreurNom
 */
const notifierCommandePrise = (commandeId, livreurNom) => {
    if (!io) return;
    io.to('room:livreurs').emit('commande:prise', {
        event: 'commande:prise',
        commandeId,
        livreurNom,
        timestamp: new Date().toISOString(),
    });
    console.log(`📡 commande:prise émis → room:livreurs | Commande #${commandeId}`);
};

module.exports = {
    initSocket,
    getIo,
    notifierNouvelleCommande,
    notifierCommandePrise,
};
