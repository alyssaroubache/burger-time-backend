// src/config/multer.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ─────────────────────────────────────────────────────────────
// SCRUM-150 : Configuration Multer
// Upload photos produits
// Formats : JPG, JPEG, PNG
// Taille max : 2 Mo
// Dossier : uploads/
// ─────────────────────────────────────────────────────────────

// Créer le dossier uploads/ s'il n'existe pas
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuration du stockage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        // Nom unique : produit_timestamp.extension
        const ext = path.extname(file.originalname).toLowerCase();
        const filename = `produit_${Date.now()}${ext}`;
        cb(null, filename);
    },
});

// Filtre des formats acceptés
const fileFilter = (req, file, cb) => {
    const formatsAcceptes = ['image/jpeg', 'image/jpg', 'image/png'];

    if (formatsAcceptes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Format invalide. Seuls JPG, JPEG et PNG sont acceptés.'), false);
    }
};

// Configuration finale
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 2 * 1024 * 1024, // 2 Mo maximum
    },
});

module.exports = upload;
