// tests/utils/generateToken.test.js
const jwt = require('jsonwebtoken');
const generateToken = require('../../src/utils/generateToken');

// ⚠️ IMPORTANT : Définir JWT_SECRET pour les tests
process.env.JWT_SECRET = 'test_secret_key_for_jwt_12345';

describe('generateToken - Utilitaire JWT', () => {
    beforeEach(() => {
        // S'assurer que JWT_SECRET est toujours défini
        if (!process.env.JWT_SECRET) {
            process.env.JWT_SECRET = 'test_secret_key_for_jwt_12345';
        }
    });

    // ==========================================================
    // 1. Cas de succès
    // ==========================================================
    describe('✅ Succès - Génération du token', () => {
        it('devrait générer un token valide pour un utilisateur', () => {
            const user = { id: 1, role: 'admin' };
            const token = generateToken(user);

            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.split('.')).toHaveLength(3);
        });

        it('devrait générer un token contenant l\'id et le role de l\'utilisateur', () => {
            const user = { id: 5, role: 'livreur' };
            const token = generateToken(user);

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            expect(decoded.id).toBe(5);
            expect(decoded.role).toBe('livreur');
        });

        it('devrait générer un token avec une expiration de 8 heures', () => {
            const user = { id: 1, role: 'admin' };
            const token = generateToken(user);

            const decoded = jwt.decode(token);
            expect(decoded.exp).toBeDefined();

            const nowInSeconds = Math.floor(Date.now() / 1000);
            const expirationInSeconds = decoded.exp;
            const difference = expirationInSeconds - nowInSeconds;

            expect(difference).toBeGreaterThan(28795);
            expect(difference).toBeLessThan(28805);
        });
    });

    // ==========================================================
    // 2. Cas d'erreur
    // ==========================================================
    describe('❌ Erreurs', () => {
        it('devrait générer un token sans id si l\'utilisateur n\'a pas d\'id', () => {
            const user = { role: 'admin' };
            const token = generateToken(user);
            const decoded = jwt.decode(token);
            expect(decoded.id).toBeUndefined();
        });

        it('devrait générer un token sans role si l\'utilisateur n\'a pas de role', () => {
            const user = { id: 1 };
            const token = generateToken(user);
            const decoded = jwt.decode(token);
            expect(decoded.role).toBeUndefined();
        });
    });
});