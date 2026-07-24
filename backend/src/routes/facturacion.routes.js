const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/facturas.controller');
const { verificarToken, permitirRoles } = require('../middlewares/auth.middleware');

router.use(verificarToken);

router.get('/', ctrl.listar);
router.get('/:id', ctrl.obtener);
router.post('/generar', permitirRoles('admin', 'ventas'), ctrl.generarDesdeOrdenVenta);
router.post('/:id/pagos', permitirRoles('admin', 'ventas'), ctrl.registrarPago);

module.exports = router;
