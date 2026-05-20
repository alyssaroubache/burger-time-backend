// tests/livreurController.test.js
const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/config/db');

// Mocks des modules externes
jest.mock('../src/config/db', () => ({
    query: jest.fn(),
    connect: jest.fn()
}));

jest.mock('../src/socket', () => ({
    notifierCommandePrise: jest.fn()
}));

jest.mock('../src/services/emailService', () => ({
    envoyerEmailPriseEnCharge: jest.fn().mockResolvedValue(true)
}));

// Mock du middleware d'authentification
jest.mock('../src/middlewares/auth', () => ({
    protect: (req, res, next) => {
        req.user = { id: 1, nom_complet: 'Livreur Test', role: 'livreur' };
        next();
    },
    isAdmin: (req, res, next) => next(),
    isLivreur: (req, res, next) => next()
}));

describe('Livreur Controller - Routes protégées', () => {
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
    // 1. POST /api/auth/login - Authentification (133, 134)
    // ==========================================================
    describe('POST /api/auth/login', () => {
        it('devrait retourner 400 si email manquant', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ password: '123456' });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Email et mot de passe sont obligatoires.');
        });

        it('devrait retourner 400 si mot de passe manquant', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@test.com' });

            expect(response.status).toBe(400);
        });
    });

    // ==========================================================
    // 2. GET /api/livreur/orders/new (135)
    // ==========================================================
    describe('GET /api/livreur/orders/new', () => {
        it('devrait retourner 200 avec succès', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            const response = await request(app)
                .get('/api/livreur/orders/new')
                .set('Authorization', 'Bearer fake-token');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('devrait retourner 500 en cas d\'erreur base de données', async () => {
            pool.query.mockRejectedValueOnce(new Error('Database error'));

            const response = await request(app)
                .get('/api/livreur/orders/new')
                .set('Authorization', 'Bearer fake-token');

            expect(response.status).toBe(500);
        });
    });

    // ==========================================================
    // 3. GET /api/livreur/orders/in-progress (136)
    // ==========================================================
    describe('GET /api/livreur/orders/in-progress', () => {
        it('devrait retourner 200 avec succès', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            const response = await request(app)
                .get('/api/livreur/orders/in-progress')
                .set('Authorization', 'Bearer fake-token');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });

    // ==========================================================
    // 4. GET /api/livreur/orders/delivered (137)
    // ==========================================================
    describe('GET /api/livreur/orders/delivered', () => {
        it('devrait retourner 200 avec succès', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            const response = await request(app)
                .get('/api/livreur/orders/delivered')
                .set('Authorization', 'Bearer fake-token');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });

    // ==========================================================
    // 5. PUT /api/livreur/orders/:id/take (138, 139)
    // ==========================================================
    describe('PUT /api/livreur/orders/:id/take', () => {
        const mockClient = {
            query: jest.fn(),
            release: jest.fn()
        };

        beforeEach(() => {
            pool.connect.mockResolvedValue(mockClient);
        });

        it('devrait retourner 404 ou 500 si commande introuvable', async () => {
            mockClient.query.mockResolvedValueOnce({ rows: [] });

            const response = await request(app)
                .put('/api/livreur/orders/999/take')
                .set('Authorization', 'Bearer fake-token');

            expect([404, 500]).toContain(response.status);
        });
    });

    // ==========================================================
    // 6. PUT /api/livreur/orders/:id/deliver (140, 141)
    // ==========================================================
    describe('PUT /api/livreur/orders/:id/deliver', () => {
        const mockClient = {
            query: jest.fn(),
            release: jest.fn()
        };

        beforeEach(() => {
            pool.connect.mockResolvedValue(mockClient);
        });

        it('devrait retourner 404 ou 500 si commande introuvable', async () => {
            mockClient.query.mockResolvedValueOnce({ rows: [] });

            const response = await request(app)
                .put('/api/livreur/orders/999/deliver')
                .set('Authorization', 'Bearer fake-token');

            expect([404, 500]).toContain(response.status);
        });
    });

    // ==========================================================
    // 7. PUT /api/livreur/orders/:id/abandon (142)
    // ==========================================================
    describe('PUT /api/livreur/orders/:id/abandon', () => {
        it('devrait retourner 400 si motif d\'abandon manquant', async () => {
            const response = await request(app)
                .put('/api/livreur/orders/1/abandon')
                .set('Authorization', 'Bearer fake-token')
                .send({});

            expect(response.status).toBe(400);
            expect(response.body.champ).toBe('abandon_reason');
        });
    });
});