const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/estadisticas.controller');
const { verificarToken, permitirRoles } = require('../middlewares/auth.middleware');

router.use(verificarToken);

router.get('/resumen', permitirRoles('admin'), ctrl.resumen);

module.exports = router;
