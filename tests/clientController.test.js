// tests/clientController.test.js
const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/config/db');

// Mock du module pool (base de données)
jest.mock('../src/config/db', () => ({
    query: jest.fn()
}));

describe('Client Controller - Routes publiques', () => {
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
    // 1. GET /api/categories
    // ==========================================================
    describe('GET /api/categories', () => {
        it('devrait retourner la liste des catégories actives avec un code 200', async () => {
            const mockCategories = [
                { id: 1, nom: 'Burgers', description: 'Nos burgers', url_image: null, ordre_affichage: 1 },
                { id: 2, nom: 'Boissons', description: 'Boissons fraîches', url_image: null, ordre_affichage: 2 }
            ];
            pool.query.mockResolvedValueOnce({ rows: mockCategories });

            const response = await request(app).get('/api/categories');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(mockCategories);
        });

        it('devrait retourner une erreur 500 en cas de problème base de données', async () => {
            pool.query.mockRejectedValueOnce(new Error('Database error'));

            const response = await request(app).get('/api/categories');

            expect(response.status).toBe(500);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Erreur serveur. Veuillez réessayer.');
        });
    });

    // ==========================================================
    // 2. GET /api/produits
    // ==========================================================
    describe('GET /api/produits', () => {
        it('devrait retourner la liste des produits disponibles avec un code 200', async () => {
            const mockProduits = [
                { id: 1, nom: 'Burger Classic', prix: 8.50, categorie: 'Burgers' }
            ];
            pool.query.mockResolvedValueOnce({ rows: mockProduits });

            const response = await request(app).get('/api/produits');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.filtre).toBe('aucun');
            expect(response.body.data).toEqual(mockProduits);
        });

        it('devrait retourner les produits filtrés par catégorie avec un code 200', async () => {
            const mockProduits = [
                { id: 1, nom: 'Burger Classic', prix: 8.50, categorie: 'Burgers' }
            ];
            pool.query.mockResolvedValueOnce({ rows: mockProduits });

            const response = await request(app).get('/api/produits?category_id=1');

            expect(response.status).toBe(200);
            expect(response.body.filtre).toBe('category_id = 1');
        });

        it('devrait retourner une erreur 400 si category_id est invalide', async () => {
            const response = await request(app).get('/api/produits?category_id=abc');

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('category_id doit être un nombre valide.');
        });

        it('devrait retourner une erreur 500 en cas de problème base de données', async () => {
            pool.query.mockRejectedValueOnce(new Error('Database error'));

            const response = await request(app).get('/api/produits');

            expect(response.status).toBe(500);
            expect(response.body.success).toBe(false);
        });
    });

    // ==========================================================
    // 3. GET /api/categories/:id
    // ==========================================================
    describe('GET /api/categories/:id', () => {
        it('devrait retourner une catégorie spécifique avec un code 200', async () => {
            const mockCategorie = { id: 1, nom: 'Burgers', description: 'Nos burgers', url_image: null, ordre_affichage: 1 };
            pool.query.mockResolvedValueOnce({ rows: [mockCategorie] });

            const response = await request(app).get('/api/categories/1');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(mockCategorie);
        });

        it('devrait retourner une erreur 404 si la catégorie n\'existe pas', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] });

            const response = await request(app).get('/api/categories/999');

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Catégorie non trouvée');
        });

        it('devrait retourner une erreur 500 en cas de problème base de données', async () => {
            pool.query.mockRejectedValueOnce(new Error('Database error'));

            const response = await request(app).get('/api/categories/1');

            expect(response.status).toBe(500);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Erreur serveur');
        });
    });
});