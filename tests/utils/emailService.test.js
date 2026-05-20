// tests/utils/emailService.test.js
const nodemailer = require('nodemailer');
const { envoyerEmailPriseEnCharge } = require('../../src/utils/emailService');

// Mock de nodemailer
jest.mock('nodemailer', () => ({
    createTransport: jest.fn(() => ({
        sendMail: jest.fn()
    }))
}));

describe('emailService - Envoi d\'emails (SCRUM-104)', () => {
    let mockTransporter;
    let mockSendMail;

    beforeEach(() => {
        jest.clearAllMocks();

        // Configuration des variables d'environnement
        process.env.SMTP_HOST = 'smtp.gmail.com';
        process.env.SMTP_PORT = '587';
        process.env.SMTP_SECURE = 'false';
        process.env.SMTP_USER = 'test@burgertime.com';
        process.env.SMTP_PASS = 'secret';

        mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id-123' });
        mockTransporter = {
            sendMail: mockSendMail
        };
        nodemailer.createTransport.mockReturnValue(mockTransporter);
    });

    // ==========================================================
    // 1. Cas de succès
    // ==========================================================
    describe('✅ Succès - Envoi d\'email', () => {
        const mockEmailData = {
            clientEmail: 'client@test.com',
            clientPrenom: 'Karim',
            commandeId: 123,
            livreurNom: 'Livreur Test',
            adresseLivraison: '12 rue Didouche, Alger',
            heurePrevue: new Date().toISOString(),
            produits: [
                { produit: 'Burger', quantite: 2, sous_total: 1000 },
                { produit: 'Frites', quantite: 1, sous_total: 200 }
            ],
            montantTotal: 1200
        };

        it('devrait envoyer un email avec succès et retourner messageId', async () => {
            const result = await envoyerEmailPriseEnCharge(mockEmailData);

            expect(result.success).toBe(true);
            expect(result.messageId).toBe('test-id-123');
            expect(mockSendMail).toHaveBeenCalledTimes(1);
        });

        it('devrait appeler sendMail avec les bons paramètres', async () => {
            await envoyerEmailPriseEnCharge(mockEmailData);

            expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
                to: 'client@test.com',
                subject: expect.stringContaining('Commande #123')
            }));
        });

        it('devrait créer un transporteur SMTP avec les bons paramètres', async () => {
            await envoyerEmailPriseEnCharge(mockEmailData);

            expect(nodemailer.createTransport).toHaveBeenCalledWith({
                host: 'smtp.gmail.com',
                port: 587,
                secure: false,
                auth: {
                    user: 'test@burgertime.com',
                    pass: 'secret'
                },
                tls: { rejectUnauthorized: false }
            });
        });
    });

    // ==========================================================
    // 2. Cas particuliers
    // ==========================================================
    describe('⚠️ Cas particuliers', () => {
        it('devrait ignorer silencieusement si clientEmail est manquant (optionnel CLI-018)', async () => {
            const emailDataSansEmail = {
                clientPrenom: 'Karim',
                commandeId: 123,
                livreurNom: 'Livreur Test',
                adresseLivraison: '12 rue Didouche',
                heurePrevue: new Date().toISOString(),
                produits: [],
                montantTotal: 1200
            };

            const result = await envoyerEmailPriseEnCharge(emailDataSansEmail);

            expect(result.success).toBe(true);
            expect(result.skipped).toBe(true);
            expect(mockSendMail).not.toHaveBeenCalled();
        });
    });

    // ==========================================================
    // 3. Cas d'erreur (non-bloquant)
    // ==========================================================
    describe('❌ Erreurs (non-bloquantes)', () => {
        const mockEmailData = {
            clientEmail: 'client@test.com',
            clientPrenom: 'Karim',
            commandeId: 123,
            livreurNom: 'Livreur Test',
            adresseLivraison: '12 rue Didouche, Alger',
            heurePrevue: new Date().toISOString(),
            produits: [{ produit: 'Burger', quantite: 2, sous_total: 1000 }],
            montantTotal: 1000
        };

        it('devrait retourner success: false en cas d\'erreur d\'envoi (sans bloquer)', async () => {
            mockSendMail.mockRejectedValueOnce(new Error('SMTP connection failed'));

            const result = await envoyerEmailPriseEnCharge(mockEmailData);

            expect(result.success).toBe(false);
            expect(result.error).toBe('SMTP connection failed');
        });

        it('devrait logguer l\'erreur mais ne pas bloquer l\'exécution', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            mockSendMail.mockRejectedValueOnce(new Error('Email error'));

            await envoyerEmailPriseEnCharge(mockEmailData);

            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });
});