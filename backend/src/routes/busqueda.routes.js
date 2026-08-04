const express = require('express');
const router = express.Router();

const {
  buscarGlobal,
} = require('../controllers/busqueda.controller');

const {
  verificarToken,
} = require('../middlewares/auth.middleware');

router.get('/', verificarToken, buscarGlobal);

module.exports = router;