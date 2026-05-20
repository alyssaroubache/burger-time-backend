// prisma.config.js
require('dotenv').config(); // Charge les variables du fichier .env

module.exports = {
  datasource: {
    url: process.env.DATABASE_URL,
  }
};