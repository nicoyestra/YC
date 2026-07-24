const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/inventario.controller');
const { verificarToken, permitirRoles } = require('../middlewares/auth.middleware');

router.use(verificarToken);

router.get('/almacenes', ctrl.listarAlmacenes);
router.get('/movimientos', ctrl.historial);
router.post('/movimientos', permitirRoles('admin', 'inventario'), ctrl.registrarMovimiento);

module.exports = router;
