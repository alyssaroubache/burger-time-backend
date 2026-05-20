// src/utils/emailService.js
// ─────────────────────────────────────────────────────────────
// SCRUM-104 : Service d'envoi d'emails — Nodemailer
// Notification client après prise en charge de sa commande
// ─────────────────────────────────────────────────────────────
const nodemailer = require('nodemailer');

// ── Création du transporteur SMTP ─────────────────────────────
const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true', // true = port 465, false = STARTTLS
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
        tls: {
            rejectUnauthorized: false, // Tolérance pour les envs de dev
        },
    });
};

// ── Template HTML — Email de confirmation de prise en charge ──
const buildEmailPriseEnCharge = (data) => {
    const {
        clientPrenom,
        commandeId,
        livreurNom,
        adresseLivraison,
        heurePrevue,
        produits,
        montantTotal,
    } = data;

    const heureFormatee = new Date(heurePrevue).toLocaleString('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short',
    });

    const lignesProduits = produits
        .map(
            (p) => `
            <tr>
                <td style="padding:10px 16px;border-bottom:1px solid #f0e6d3;font-size:14px;color:#3d2b1f;">
                    ${p.produit}
                </td>
                <td style="padding:10px 16px;border-bottom:1px solid #f0e6d3;font-size:14px;color:#3d2b1f;text-align:center;">
                    x${p.quantite}
                </td>
                <td style="padding:10px 16px;border-bottom:1px solid #f0e6d3;font-size:14px;color:#e8521a;text-align:right;font-weight:600;">
                    ${parseFloat(p.sous_total).toFixed(2)} DA
                </td>
            </tr>`
        )
        .join('');
        

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Votre commande BurgerTime est en route !</title>
</head>
<body style="margin:0;padding:0;background-color:#fdf6ee;font-family:'Segoe UI',Arial,sans-serif;">

    <!-- Wrapper -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf6ee;padding:40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0"
                       style="max-width:600px;background:#ffffff;border-radius:16px;
                              overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

                    <!-- ── HEADER ── -->
                    <tr>
                        <td style="background:linear-gradient(135deg,#e8521a 0%,#c93d0c 100%);
                                   padding:36px 40px;text-align:center;">
                            <p style="margin:0 0 6px 0;font-size:34px;letter-spacing:2px;">🍔</p>
                            <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;
                                       letter-spacing:1px;">BurgerTime</h1>
                            <p style="margin:8px 0 0 0;color:#ffd3b8;font-size:13px;
                                      letter-spacing:0.5px;">VOTRE REPAS EST EN ROUTE</p>
                        </td>
                    </tr>

                    <!-- ── BANNIÈRE STATUT ── -->
                    <tr>
                        <td style="background:#fff8f0;padding:20px 40px;text-align:center;
                                   border-bottom:2px dashed #f0e6d3;">
                            <span style="display:inline-block;background:#e8f5e9;color:#2e7d32;
                                         padding:8px 20px;border-radius:24px;font-size:14px;
                                         font-weight:700;letter-spacing:0.5px;">
                                ✅ &nbsp;Commande prise en charge
                            </span>
                        </td>
                    </tr>

                    <!-- ── CORPS ── -->
                    <tr>
                        <td style="padding:36px 40px;">

                            <p style="margin:0 0 24px 0;font-size:16px;color:#3d2b1f;line-height:1.6;">
                                Bonjour <strong>${clientPrenom}</strong> ! 👋<br/>
                                Bonne nouvelle : votre livreur <strong>${livreurNom}</strong>
                                a pris en charge votre commande et se dirige vers vous.
                            </p>

                            <!-- Infos commande -->
                            <table width="100%" cellpadding="0" cellspacing="0"
                                   style="background:#fff8f0;border-radius:12px;
                                          border:1px solid #f0e6d3;margin-bottom:28px;">
                                <tr>
                                    <td style="padding:16px 20px;border-bottom:1px solid #f0e6d3;">
                                        <span style="font-size:12px;color:#9e7b5e;
                                                     text-transform:uppercase;letter-spacing:0.8px;">
                                            Numéro de commande
                                        </span><br/>
                                        <strong style="font-size:20px;color:#e8521a;">
                                            #${commandeId}
                                        </strong>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:16px 20px;border-bottom:1px solid #f0e6d3;">
                                        <span style="font-size:12px;color:#9e7b5e;
                                                     text-transform:uppercase;letter-spacing:0.8px;">
                                            📍 Adresse de livraison
                                        </span><br/>
                                        <span style="font-size:15px;color:#3d2b1f;">
                                            ${adresseLivraison}
                                        </span>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:16px 20px;">
                                        <span style="font-size:12px;color:#9e7b5e;
                                                     text-transform:uppercase;letter-spacing:0.8px;">
                                            🕐 Heure de livraison prévue
                                        </span><br/>
                                        <span style="font-size:15px;color:#3d2b1f;font-weight:600;">
                                            ${heureFormatee}
                                        </span>
                                    </td>
                                </tr>
                            </table>

                            <!-- Récapitulatif produits -->
                            <p style="margin:0 0 12px 0;font-size:14px;font-weight:700;
                                      color:#3d2b1f;text-transform:uppercase;letter-spacing:0.8px;">
                                🧾 Récapitulatif de votre commande
                            </p>
                            <table width="100%" cellpadding="0" cellspacing="0"
                                   style="border-radius:12px;overflow:hidden;
                                          border:1px solid #f0e6d3;margin-bottom:28px;">
                                <thead>
                                    <tr style="background:#f5ebe0;">
                                        <th style="padding:10px 16px;text-align:left;font-size:12px;
                                                   color:#9e7b5e;text-transform:uppercase;
                                                   letter-spacing:0.6px;">Produit</th>
                                        <th style="padding:10px 16px;text-align:center;font-size:12px;
                                                   color:#9e7b5e;text-transform:uppercase;
                                                   letter-spacing:0.6px;">Qté</th>
                                        <th style="padding:10px 16px;text-align:right;font-size:12px;
                                                   color:#9e7b5e;text-transform:uppercase;
                                                   letter-spacing:0.6px;">Sous-total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${lignesProduits}
                                    <tr style="background:#fff8f0;">
                                        <td colspan="2"
                                            style="padding:14px 16px;font-size:15px;
                                                   font-weight:700;color:#3d2b1f;">
                                            Total à payer
                                        </td>
                                        <td style="padding:14px 16px;font-size:18px;
                                                   font-weight:800;color:#e8521a;text-align:right;">
                                            ${parseFloat(montantTotal).toFixed(2)} DA
                                        </td>
                                    </tr>
                                </tbody>
                            </table>

                            <!-- Conseil -->
                            <table width="100%" cellpadding="0" cellspacing="0"
                                   style="background:#fff3e0;border-radius:12px;
                                          border-left:4px solid #e8521a;">
                                <tr>
                                    <td style="padding:16px 20px;font-size:14px;
                                               color:#5d4037;line-height:1.6;">
                                        💡 <strong>Conseil :</strong> Préparez le montant exact
                                        pour faciliter la livraison.
                                        Le paiement s'effectue à la réception.
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- ── FOOTER ── -->
                    <tr>
                        <td style="background:#3d2b1f;padding:24px 40px;text-align:center;">
                            <p style="margin:0 0 6px 0;color:#c9a87c;font-size:13px;">
                                Merci de votre confiance 🍔
                            </p>
                            <p style="margin:0;color:#7a5c45;font-size:11px;">
                                BurgerTime — Des burgers livrés avec passion
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>

</body>
</html>`;

    const text = `
Bonjour ${clientPrenom},

Votre commande #${commandeId} a été prise en charge par ${livreurNom}.

📍 Livraison à : ${adresseLivraison}
🕐 Heure prévue : ${heureFormatee}
💰 Total à payer : ${parseFloat(montantTotal).toFixed(2)} DA

Préparez le montant exact. Le paiement s'effectue à la réception.

— BurgerTime
    `.trim();

    return { html, text };
};

// ── Fonction principale d'envoi ────────────────────────────────
/**
 * Envoie un email de notification au client après prise en charge.
 * @param {Object} data - { clientEmail, clientPrenom, commandeId,
 *                          livreurNom, adresseLivraison, heurePrevue,
 *                          produits, montantTotal }
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
const envoyerEmailPriseEnCharge = async (data) => {
    // Si pas d'email client → on skip silencieusement (champ optionnel CLI-018)
    if (!data.clientEmail) {
        console.log(`📭 SCRUM-104 : Pas d'email pour commande #${data.commandeId} — skip.`);
        return { success: true, skipped: true };
    }

    const transporter = createTransporter();
    const { html, text } = buildEmailPriseEnCharge(data);

    try {
        const info = await transporter.sendMail({
            from: `"🍔 BurgerTime" <${process.env.SMTP_USER}>`,
            to: data.clientEmail,
            subject: `✅ Commande #${data.commandeId} — Votre livreur arrive !`,
            text,
            html,
        });

        console.log(`📧 SCRUM-104 : Email envoyé → ${data.clientEmail} | ID: ${info.messageId}`);
        return { success: true, messageId: info.messageId };

    } catch (err) {
        // On log l'erreur MAIS on ne bloque pas la réponse HTTP (non-bloquant)
        console.error(`❌ SCRUM-104 : Échec email commande #${data.commandeId} :`, err.message);
        return { success: false, error: err.message };
    }
};

module.exports = { envoyerEmailPriseEnCharge };
