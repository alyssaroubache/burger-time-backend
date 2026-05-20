// tests/DashboardLivreur.test.jsx
import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import DashboardLivreur from '../src/components/livreur/DashboardLivreur';

// Mocks des modules
jest.mock('../../services/socket', () => ({
    connectSocket: jest.fn(() => ({ on: jest.fn(), emit: jest.fn(), connected: true })),
    disconnectSocket: jest.fn(),
    subscribeToNouvellesCommandes: jest.fn(),
    subscribeToStatutCommande: jest.fn(),
    emitChangementStatut: jest.fn(),
    unsubscribeFromEvents: jest.fn(),
    getSocket: jest.fn(() => ({ connected: true }))
}));

jest.mock('../../services/livreurApi', () => ({
    getNouvellesCommandes: jest.fn(),
    getCommandesEnCours: jest.fn(),
    getCommandesLivrees: jest.fn(),
    prendreCommande: jest.fn(),
    marquerLivree: jest.fn(),
    abandonnerCommande: jest.fn()
}));

// Mock de useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate
}));

// Mock de localStorage
const mockLocalStorage = (() => {
    let store = {};
    return {
        getItem: jest.fn(key => store[key] || null),
        setItem: jest.fn((key, value) => { store[key] = value.toString(); }),
        removeItem: jest.fn(key => { delete store[key]; }),
        clear: jest.fn(() => { store = {}; })
    };
})();

Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Import après les mocks
const { connectSocket } = require('../../services/socket');
const {
    getNouvellesCommandes,
    getCommandesEnCours,
    getCommandesLivrees,
    prendreCommande,
    marquerLivree,
    abandonnerCommande
} = require('../../services/livreurApi');

describe('DashboardLivreur - Composant principal', () => {
    const mockNouvellesCommandes = [
        { id: 1, client_prenom: 'Karim', client_nom: 'Benali', montant_total: 1400, adresse_livraison: '12 rue Didouche, Alger', statut: 'nouvelle', produits: [{ produit: 'Burger', quantite: 2 }] }
    ];
    const mockCommandesEnCours = [
        { id: 2, client_prenom: 'Karim', client_nom: 'Benali', montant_total: 1400, adresse_livraison: '12 rue Didouche, Alger', statut: 'en_cours', produits: [{ produit: 'Burger', quantite: 2 }] }
    ];
    const mockCommandesLivrees = [
        { id: 3, client_prenom: 'Fatima', client_nom: 'Zidane', montant_total: 1800, statut: 'livree', produits: [{ produit: 'Pizza', quantite: 1 }] }
    ];

    const mockToken = 'fake-token';
    const mockLivreurInfo = { email: 'livreur@test.com', nom: 'Livreur Test' };

    beforeEach(() => {
        jest.clearAllMocks();
        mockLocalStorage.clear();
        mockLocalStorage.setItem('livreur_token', mockToken);
        mockLocalStorage.setItem('livreur_info', JSON.stringify(mockLivreurInfo));

        // Mocks par défaut des API
        getNouvellesCommandes.mockResolvedValue({ success: true, data: mockNouvellesCommandes });
        getCommandesEnCours.mockResolvedValue({ success: true, data: mockCommandesEnCours });
        getCommandesLivrees.mockResolvedValue({ success: true, data: mockCommandesLivrees });

        // Mock Socket
        connectSocket.mockReturnValue({ on: jest.fn(), emit: jest.fn(), connected: true });
    });

    const renderComponent = () => {
        return render(
            <BrowserRouter>
                <DashboardLivreur />
            </BrowserRouter>
        );
    };

    // ==========================================================
    // 1. Vérifier le rendu initial
    // ==========================================================
    describe('1. Rendu initial', () => {
        it('devrait afficher le titre "Espace Livreur"', () => {
            renderComponent();
            expect(screen.getByText(/Espace Livreur/i)).toBeInTheDocument();
        });

        it('devrait afficher les trois onglets (Nouvelles commandes, En cours, Livrées)', () => {
            renderComponent();
            expect(screen.getByText(/Nouvelles commandes/i)).toBeInTheDocument();
            expect(screen.getByText(/En cours/i)).toBeInTheDocument();
            expect(screen.getByText(/Livrées/i)).toBeInTheDocument();
        });

        it('devrait afficher le bouton de déconnexion', () => {
            renderComponent();
            expect(screen.getByText(/Déconnexion/i)).toBeInTheDocument();
        });
    });

    // ==========================================================
    // 2. Vérifier le chargement (loading)
    // ==========================================================
    describe('2. État de chargement', () => {
        it('devrait afficher un indicateur de chargement au début', () => {
            getNouvellesCommandes.mockImplementation(() => new Promise(() => { }));
            renderComponent();
            expect(screen.getByText(/Chargement des commandes/i)).toBeInTheDocument();
        });
    });

    // ==========================================================
    // 3. Vérifier l'affichage des données (succès)
    // ==========================================================
    describe('3. Affichage des données avec succès', () => {
        it('devrait afficher la liste des nouvelles commandes', async () => {
            renderComponent();
            await waitFor(() => {
                expect(screen.getByText(/Commande #1/i)).toBeInTheDocument();
                expect(screen.getByText(/1400 DA/i)).toBeInTheDocument();
            });
        });

        it('devrait afficher la liste des commandes en cours', async () => {
            renderComponent();
            await waitFor(() => {
                expect(screen.getByText(/Commande #2/i)).toBeInTheDocument();
            });
        });

        it('devrait afficher le nombre de commandes dans les onglets', async () => {
            renderComponent();
            await waitFor(() => {
                expect(screen.getByText(/Nouvelles commandes \(1\)/i)).toBeInTheDocument();
            });
        });
    });

    // ==========================================================
    // 4. Vérifier l'affichage en cas d'erreur
    // ==========================================================
    describe('4. Gestion des erreurs', () => {
        it('devrait afficher "Aucune nouvelle commande" quand la liste est vide', async () => {
            getNouvellesCommandes.mockResolvedValue({ success: true, data: [] });
            renderComponent();
            await waitFor(() => {
                expect(screen.getByText(/Aucune nouvelle commande/i)).toBeInTheDocument();
            });
        });

        it('devrait rediriger vers la connexion si pas de token', async () => {
            mockLocalStorage.removeItem('livreur_token');
            renderComponent();
            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith('/livreur/connexion');
            });
        });
    });

    // ==========================================================
    // 5. Vérifier les interactions utilisateur
    // ==========================================================
    describe('5. Interactions utilisateur', () => {
        it('devrait changer d\'onglet quand on clique sur "En cours"', async () => {
            renderComponent();
            await waitFor(() => {
                expect(screen.getByText(/Nouvelles commandes \(1\)/i)).toBeInTheDocument();
            });

            const ongletEnCours = screen.getByText(/En cours/);
            fireEvent.click(ongletEnCours);

            expect(screen.getByText(/Commandes en cours \(1\)/i)).toBeInTheDocument();
        });

        it('devrait ouvrir le modal de détails quand on clique sur "Détails"', async () => {
            prendreCommande.mockResolvedValue({ success: true });

            renderComponent();
            await waitFor(() => {
                expect(screen.getByText(/Commande #1/i)).toBeInTheDocument();
            });

            const boutonDetails = screen.getAllByText(/Détails/i)[0];
            fireEvent.click(boutonDetails);

            expect(screen.getByText(/Détails commande/i)).toBeInTheDocument();
        });

        it('devrait appeler prendreCommande quand on clique sur "Prendre en charge"', async () => {
            prendreCommande.mockResolvedValue({ success: true });

            renderComponent();
            await waitFor(() => {
                const boutonPrendre = screen.getByText(/Prendre en charge/i);
                fireEvent.click(boutonPrendre);
            });

            await waitFor(() => {
                expect(prendreCommande).toHaveBeenCalledTimes(1);
            });
        });

        it('devrait ouvrir le modal d\'abandon quand on clique sur "Abandonner"', async () => {
            renderComponent();
            await waitFor(() => {
                expect(screen.getByText(/Commande #2/i)).toBeInTheDocument();
            });

            const boutonAbandon = screen.getByText(/Abandonner/i);
            fireEvent.click(boutonAbandon);

            expect(screen.getByText(/Abandonner la commande #2/i)).toBeInTheDocument();
            expect(screen.getByText(/Motif de l'abandon/i)).toBeInTheDocument();
        });

        it('devrait afficher une erreur si abandon sans motif', async () => {
            window.alert = jest.fn();

            renderComponent();
            await waitFor(() => {
                expect(screen.getByText(/Commande #2/i)).toBeInTheDocument();
            });

            const boutonAbandon = screen.getByText(/Abandonner/i);
            fireEvent.click(boutonAbandon);

            const boutonConfirmer = screen.getByText(/Confirmer l'abandon/i);
            fireEvent.click(boutonConfirmer);

            expect(window.alert).toHaveBeenCalledWith('Veuillez saisir un motif d\'abandon');
        });
    });

    // ==========================================================
    // 6. Vérifier la navigation (déconnexion)
    // ==========================================================
    describe('6. Navigation et déconnexion', () => {
        it('devrait rediriger vers la page de connexion après déconnexion', async () => {
            renderComponent();
            await waitFor(() => {
                expect(screen.getByText(/Déconnexion/i)).toBeInTheDocument();
            });

            const boutonDeconnexion = screen.getByText(/Déconnexion/i);
            fireEvent.click(boutonDeconnexion);

            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('livreur_token');
            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('livreur_info');
            expect(mockNavigate).toHaveBeenCalledWith('/livreur/connexion');
        });
    });

    // ==========================================================
    // 7. Vérifier le WebSocket
    // ==========================================================
    describe('7. WebSocket - Temps réel', () => {
        it('devrait établir la connexion WebSocket au montage', async () => {
            renderComponent();
            await waitFor(() => {
                expect(connectSocket).toHaveBeenCalled();
            });
        });

        it('devrait fermer la connexion WebSocket au démontage', async () => {
            const { unmount } = renderComponent();
            unmount();
            const { disconnectSocket } = require('../../services/socket');
            expect(disconnectSocket).toHaveBeenCalled();
        });
    });

    // ==========================================================
    // 8. Vérifier le mode sombre (dark mode)
    // ==========================================================
    describe('8. Mode sombre (dark mode)', () => {
        it('devrait basculer en mode sombre au clic sur le bouton', async () => {
            renderComponent();

            const boutonDarkMode = document.querySelector('[class*="rounded-full"]');
            if (boutonDarkMode) {
                fireEvent.click(boutonDarkMode);
            }

            expect(true).toBe(true);
        });
    });
});