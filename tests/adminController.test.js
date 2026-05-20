// tests/adminController.test.js
const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/config/db');

// Mocks des modules externes
jest.mock('../src/config/db', () => ({
    query: jest.fn(),
    connect: jest.fn()
}));

jest.mock('../src/config/multer', () => ({
    single: jest.fn(() => (req, res, next) => next())
}));

// Mock de bcrypt
jest.mock('bcrypt', () => ({
    compare: jest.fn().mockResolvedValue(true),
    hash: jest.fn().mockResolvedValue('$2b$10$hashed')
}));

// Mock du middleware d'authentification admin
jest.mock('../src/middlewares/auth', () => ({
    protect: (req, res, next) => {
        req.user = { id: 1, nom_complet: 'Admin Test', role: 'admin' };
        next();
    },
    isAdmin: (req, res, next) => next(),
    isLivreur: (req, res, next) => next()
}));

describe('Admin Controller - Routes protégées (admin uniquement)', () => {
    let consoleSpy;

    beforeAll(() => {
        consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterAll(() => {
        consoleSpy.mockRestore();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ==========================================================
    // 1. POST /api/auth/login - Authentification admin (144)
    // ==========================================================
    describe('POST /api/auth/login - Authentification admin', () => {
        it('devrait retourner 200 avec un token pour un admin valide', async () => {
            const mockUser = {
                rows: [{
                    id: 1,
                    email: 'admin@test.com',
                    mot_de_passe_hash: '$2b$10$hash',
                    nom_complet: 'Admin Test',
                    role: 'admin',
                    actif: true
                }]
            };
            pool.query.mockResolvedValueOnce(mockUser);

            const response = await request(app)
                .post('/api/auth/login')
                .send({ email: 'admin@test.com', password: '123456' });

            expect(response.status).toBe(200);
            expect(response.body.token).toBeDefined();
        });

        it('devrait retourner 401 pour des identifiants invalides', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            const response = await request(app)
                .post('/api/auth/login')
                .send({ email: 'wrong@test.com', password: 'wrong' });

            expect(response.status).toBe(401);
        });
    });

    // ==========================================================
    // 2. GET /api/admin/orders/all - Toutes commandes (145)
    // ==========================================================
    describe('GET /api/admin/orders/all', () => {
        it('devrait retourner la liste de toutes les commandes (200)', async () => {
            const mockCommandes = {
                rows: [
                    { id: 1, montant_total: 1400, statut: 'livree', client_prenom: 'Karim', client_nom: 'Benali' }
                ]
            };
            pool.query.mockResolvedValueOnce(mockCommandes);

            const response = await request(app)
                .get('/api/admin/orders/all')
                .set('Authorization', 'Bearer fake-token');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('devrait retourner 500 en cas d\'erreur base de données', async () => {
            pool.query.mockRejectedValueOnce(new Error('Database error'));

            const response = await request(app)
                .get('/api/admin/orders/all')
                .set('Authorization', 'Bearer fake-token');

            expect(response.status).toBe(500);
        });
    });

    // ==========================================================
    // 3. GET /api/admin/orders/:id - Détails commande (146)
    // ==========================================================
    describe('GET /api/admin/orders/:id', () => {
        it('devrait retourner les détails d\'une commande (200)', async () => {
            const mockCommande = {
                rows: [{
                    id: 1,
                    montant_total: 1400,
                    statut: 'livree',
                    client_prenom: 'Karim',
                    client_nom: 'Benali'
                }]
            };
            pool.query.mockResolvedValueOnce(mockCommande);
            pool.query.mockResolvedValueOnce({ rows: [] });

            const response = await request(app)
                .get('/api/admin/orders/1')
                .set('Authorization', 'Bearer fake-token');

            expect(response.status).toBe(200);
        });

        it('devrait retourner 404 si commande introuvable', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            const response = await request(app)
                .get('/api/admin/orders/999')
                .set('Authorization', 'Bearer fake-token');

            expect(response.status).toBe(404);
        });
    });

    // ==========================================================
    // 4. GET /api/admin/orders/archived - Archives (147)
    // ==========================================================
    describe('GET /api/admin/orders/archived', () => {
        it('devrait retourner les commandes archivées (200)', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            const response = await request(app)
                .get('/api/admin/orders/archived')
                .set('Authorization', 'Bearer fake-token');

            expect(response.status).toBe(200);
        });
    });

    // ==========================================================
    // 5. GET /api/admin/orders/abandons - Abandons (148)
    // ==========================================================
    describe('GET /api/admin/orders/abandons', () => {
        it('devrait retourner les commandes abandonnées (200)', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            const response = await request(app)
                .get('/api/admin/orders/abandons')
                .set('Authorization', 'Bearer fake-token');

            expect(response.status).toBe(200);
        });
    });

    // ==========================================================
    // 6. GET /api/admin/orders/abandons/stats - Stats abandons (149)
    // ==========================================================
    describe('GET /api/admin/orders/abandons/stats', () => {
        it('devrait retourner les statistiques d\'abandons (200)', async () => {
            const mockStats = {
                rows: [{
                    total_abandons: 5,
                    montant_total_perdu: 5000,
                    moyenne_par_abandon: 1000
                }]
            };
            pool.query.mockResolvedValueOnce(mockStats);

            const response = await request(app)
                .get('/api/admin/orders/abandons/stats')
                .set('Authorization', 'Bearer fake-token');

            expect(response.status).toBe(200);
            expect(response.body.data.total_abandons).toBe(5);
        });
    });

    // ==========================================================
    // 7. GET /api/admin/orders/recent - 10 dernières commandes (150)
    // ==========================================================
    describe('GET /api/admin/orders/recent', () => {
        it('devrait retourner les 10 dernières commandes (200)', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            const response = await request(app)
                .get('/api/admin/orders/recent')
                .set('Authorization', 'Bearer fake-token');

            expect(response.status).toBe(200);
        });
    });

    // ==========================================================
    // 8. POST /api/admin/logout - Déconnexion (151)
    // ==========================================================
    describe('POST /api/admin/logout', () => {
        it('devrait retourner un message de déconnexion (200)', async () => {
            const response = await request(app)
                .post('/api/admin/logout')
                .set('Authorization', 'Bearer fake-token');

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Déconnexion réussie. Supprimez le token côté frontend.');
        });
    });

    // ==========================================================
    // 9. GET /api/admin/dashboard - Dashboard (151)
    // ==========================================================
    describe('GET /api/admin/dashboard', () => {
        it('devrait retourner les données du dashboard (200)', async () => {
            const mockCommandes = { rows: [{ count: 5 }] };
            const mockRevenue = {
                rows: [{
                    today: 1000,
                    week: 5000,
                    month: 20000,
                    total: 50000
                }]
            };

            pool.query
                .mockResolvedValueOnce(mockCommandes)
                .mockResolvedValueOnce(mockCommandes)
                .mockResolvedValueOnce(mockCommandes)
                .mockResolvedValueOnce(mockRevenue);

            const response = await request(app)
                .get('/api/admin/dashboard')
                .set('Authorization', 'Bearer fake-token');

            expect(response.status).toBe(200);
        });
    });

    // ==========================================================
    // 10. GET /api/admin/products - Liste produits
    // ==========================================================
    describe('GET /api/admin/products', () => {
        it('devrait retourner la liste des produits (200)', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            const response = await request(app)
                .get('/api/admin/products')
                .set('Authorization', 'Bearer fake-token');

            expect(response.status).toBe(200);
        });
    });

    // ==========================================================
    // 11. POST /api/admin/products - Ajout produit
    // ==========================================================
    describe('POST /api/admin/products', () => {
        it('devrait retourner 400 si nom manquant', async () => {
            const response = await request(app)
                .post('/api/admin/products')
                .set('Authorization', 'Bearer fake-token')
                .send({ prix: 10, categorie_id: 1 });

            expect(response.status).toBe(400);
        });

        it('devrait retourner 201 pour une création réussie', async () => {
            pool.query.mockResolvedValueOnce({ rows: [{ id: 1, nom: 'Test' }] });

            const response = await request(app)
                .post('/api/admin/products')
                .set('Authorization', 'Bearer fake-token')
                .send({ nom: 'Test', prix: 10, categorie_id: 1 });

            expect(response.status).toBe(201);
        });
    });

    // ==========================================================
    // 12. GET /api/admin/users/livreurs - Liste livreurs
    // ==========================================================
    describe('GET /api/admin/users/livreurs', () => {
        it('devrait retourner la liste des livreurs (200)', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            const response = await request(app)
                .get('/api/admin/users/livreurs')
                .set('Authorization', 'Bearer fake-token');

            expect(response.status).toBe(200);
        });
    });

    // ==========================================================
    // 13. POST /api/admin/users/livreurs - Ajout livreur
    // ==========================================================
    describe('POST /api/admin/users/livreurs', () => {
        it('devrait retourner 400 si champs manquants', async () => {
            const response = await request(app)
                .post('/api/admin/users/livreurs')
                .set('Authorization', 'Bearer fake-token')
                .send({ nom_complet: 'Test' });

            expect(response.status).toBe(400);
        });
    });

    // ==========================================================
    // 14. DELETE /api/admin/users/livreurs/:id - Supprimer livreur
    // ==========================================================
    describe('DELETE /api/admin/users/livreurs/:id', () => {
        it('devrait retourner 404 si livreur introuvable', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            const response = await request(app)
                .delete('/api/admin/users/livreurs/999')
                .set('Authorization', 'Bearer fake-token');

            expect(response.status).toBe(404);
        });
    });

    // ==========================================================
    // 15. GET /api/admin/categories - Liste catégories
    // ==========================================================
    describe('GET /api/admin/categories', () => {
        it('devrait retourner la liste des catégories (200)', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            const response = await request(app)
                .get('/api/admin/categories')
                .set('Authorization', 'Bearer fake-token');

            expect(response.status).toBe(200);
        });
    });
});