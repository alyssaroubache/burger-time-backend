const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const envoyerMessageContact = async (req, res) => {
    const { nom, email, message } = req.body;

    if (!nom || !email || !message) {
        return res.status(400).json({ success: false, message: 'Tous les champs sont obligatoires.' });
    }

    const mailOptions = {
        from: `"${nom}" <${email}>`,
        to: 'timeburger929@gmail.com',
        subject: `📩 Nouveau message de contact - ${nom}`,
        html: `
            <h2>Nouveau message depuis le site Burger Time</h2>
            <p><strong>Nom :</strong> ${nom}</p>
            <p><strong>Email :</strong> ${email}</p>
            <p><strong>Message :</strong></p>
            <p>${message.replace(/\n/g, '<br>')}</p>
            <hr/>
            <p style="color:gray; font-size:12px;">Message envoyé depuis le formulaire de contact</p>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        return res.status(200).json({ success: true, message: 'Message envoyé avec succès.' });
    } catch (error) {
        console.error('Erreur envoi email contact:', error);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

module.exports = { envoyerMessageContact };