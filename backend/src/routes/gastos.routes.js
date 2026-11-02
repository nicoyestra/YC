const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/gastos.controller');
const { verificarToken, permitirRoles } = require('../middlewares/auth.middleware');

router.use(verificarToken);
router.get('/', ctrl.listar);
router.post('/', permitirRoles('admin', 'compras', 'rrhh'), ctrl.crear);
router.put('/:id', permitirRoles('admin', 'compras', 'rrhh'), ctrl.actualizar);
router.get('/:id/pagos', ctrl.listarPagos);
router.post('/:id/pagos', permitirRoles('admin', 'compras', 'rrhh'), ctrl.registrarPago);
router.delete('/:id', permitirRoles('admin'), ctrl.eliminar);
module.exports = router;
