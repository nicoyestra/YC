const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/dashboard.controller');
const { verificarToken } = require('../middlewares/auth.middleware');
router.use(verificarToken);
router.get('/resumen', ctrl.resumen);
module.exports = router;
