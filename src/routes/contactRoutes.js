const express = require('express');
const router = express.Router();
const { envoyerMessageContact } = require('../controllers/contactController');

router.post('/', envoyerMessageContact);

module.exports = router;