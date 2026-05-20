require('dotenv').config();
const nodemailer = require('nodemailer');

async function test() {
    const transporteur = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    try {
        await transporteur.sendMail({
            from: `"BurgerTime" <${process.env.SMTP_USER}>`,
            to: "tonemail@gmail.com",  // Remplace par ton email pour tester
            subject: "Test BurgerTime",
            text: "✅ La configuration email fonctionne !"
        });
        console.log("✅ Email envoyé avec succès !");
    } catch (error) {
        console.error("❌ Erreur :", error.message);
    }
}

test();