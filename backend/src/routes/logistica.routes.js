const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/logistica.controller');
const { verificarToken, permitirRoles } = require('../middlewares/auth.middleware');

router.use(verificarToken);

router.get('/', ctrl.listar);
router.post('/', permitirRoles('admin', 'ventas', 'inventario'), ctrl.crear);
router.put('/:id/estado', permitirRoles('admin', 'ventas', 'inventario'), ctrl.actualizarEstado);

module.exports = router;
