// src/services/emailService.js
const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host:'74.125.140.108',
    port: parseInt(process.env.SMTP_PORT),
    secure:true,
    family: 4,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },

    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
});

const envoyerConfirmationCommande = async (to, commandeData) => {
    const { id, cree_le, client, livraison, produits, sous_total, delivery_fee, montant_total } = commandeData;

    const dateCommande = new Date(cree_le).toLocaleString('fr-FR');
    const heureLivraison = new Date(livraison.heure_prevue).toLocaleString('fr-FR');

    const produitsHtml = produits.map(p => `
        <tr>
            <td>${p.nom}</td>
            <td style="text-align:center">${p.quantite}</td>
            <td style="text-align:right">${p.prix_unitaire.toFixed(2)} DA</td>
            <td style="text-align:right">${p.sous_total.toFixed(2)} DA</td>
        </tr>
    `).join('');

    const htmlContent = `
        <h1>Merci pour votre commande !</h1>
        <p>Bonjour ${client.prenom} ${client.nom},</p>
        <p>Nous avons bien reçu votre commande <strong>#${id}</strong> passée le ${dateCommande}.</p>
        <h2>Récapitulatif</h2>
        <table border="1" cellpadding="5" style="border-collapse:collapse; width:100%">
            <thead>
                <tr><th>Produit</th><th>Qté</th><th>Prix unitaire</th><th>Sous-total</th></tr>
            </thead>
            <tbody>
                ${produitsHtml}
                <tr>
                    <td colspan="3" style="text-align:right"><strong>Sous-total</strong></td>
                    <td style="text-align:right"><strong>${sous_total.toFixed(2)} DA</strong></td>
                </tr>
                <tr>
                    <td colspan="3" style="text-align:right"><strong>Frais de livraison</strong></td>
                    <td style="text-align:right"><strong>${delivery_fee.toFixed(2)} DA</strong></td>
                </tr>
                <tr>
                    <td colspan="3" style="text-align:right"><strong>Total</strong></td>
                    <td style="text-align:right"><strong>${montant_total.toFixed(2)} DA</strong></td>
                </tr>
            </tbody>
        </table>
        <h2>Livraison</h2>
        <p><strong>Adresse :</strong> ${livraison.adresse}</p>
        <p><strong>Heure prévue :</strong> ${heureLivraison}</p>
        ${livraison.instructions ? `<p><strong>Instructions :</strong> ${livraison.instructions}</p>` : ''}
        <p>Merci de votre confiance,<br/>L'équipe Burger Time</p>
    `;

    const mailOptions = {
        from: `"Burger Time" <${process.env.SMTP_USER}>`,
        to: to,
        subject: `Confirmation de votre commande #${id}`,
        html: htmlContent,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`📧 Email envoyé à ${to} (${info.messageId})`);
        return info;
    } catch (error) {
        console.error('❌ Erreur email:', error);
        throw error;
    }
};
const envoyerEmailNouvelleCommande = async (emailLivreur, commande, livreurNom) => {
    const mailOptions = {
        from: `"Burger Time" <${process.env.SMTP_USER}>`,
        to: emailLivreur,
        subject: `🔔 Nouvelle commande #${commande.id} disponible !`,
        html: `
            <h2>Bonjour ${livreurNom},</h2>
            <p>Une nouvelle commande vient d'être passée sur Burger Time !</p>
            
            <h3>📦 Détails de la commande #${commande.id}</h3>
            <p><strong>Client :</strong> ${commande.client.prenom} ${commande.client.nom}</p>
            <p><strong>Téléphone :</strong> ${commande.client.telephone}</p>
            <p><strong>Adresse :</strong> ${commande.adresse_livraison}</p>
            <p><strong>Montant :</strong> ${commande.montant_total} DA</p>
            <p><strong>Heure prévue :</strong> ${new Date(commande.heure_prevue).toLocaleString('fr-FR')}</p>
            
            <h3>🍔 Produits commandés :</h3>
            <ul>
                ${commande.produits.map(p => `<li>${p.nom} x${p.quantite} = ${p.sous_total} DA</li>`).join('')}
            </ul>
            
            <p style="margin-top: 20px;">
                <a href="https://visionary-melba-b80b84.netlify.app/livreur/connexion"
                   style="background-color: #FF6B35; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                   📱 Connectez-vous pour prendre en charge cette commande
                </a>
            </p>
            
            <p>Si vous êtes disponible, connectez-vous rapidement pour prendre cette commande en charge.</p>
            <p>Merci pour votre engagement !</p>
            <p>L'équipe Burger Time</p>
        `,
    };
    
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`📧 Email envoyé au livreur ${livreurNom} (${emailLivreur})`);
        return info;
    } catch (error) {
        console.error('❌ Erreur envoi email livreur:', error);
        throw error;
    }
};

module.exports = { envoyerConfirmationCommande, envoyerEmailNouvelleCommande };