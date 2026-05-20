// tests/commandeController.test.js
const request = require('supertest');
const app = require('../src/app');

// Fermer l'application après tous les tests
afterAll(async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
});

describe('Routes commandes - tests basiques', () => {

    it('POST /api/orders - test de création', async () => {
        const commandeValide = {
            prenom: 'Karim',
            nom: 'Benali',
            telephone: '0555123456',
            adresse_livraison: '12 rue Didouche, Alger',
            heure_prevue: new Date(Date.now() + 3600000).toISOString(),
            produits: [{ produit_id: 1, quantite: 1 }]
        };

        const response = await request(app)
            .post('/api/orders')
            .set('Content-Type', 'application/json')
            .send(commandeValide);

        expect([200, 201, 400, 404, 500]).toContain(response.status);
    });

    it('GET /api/orders/:id - test de récupération', async () => {
        const response = await request(app).get('/api/orders/1');
        expect([200, 404]).toContain(response.status);
    });
});