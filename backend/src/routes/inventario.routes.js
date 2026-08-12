const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/inventario.controller');
const { verificarToken, permitirRoles } = require('../middlewares/auth.middleware');

router.use(verificarToken);

router.get('/almacenes', ctrl.listarAlmacenes);
router.get('/movimientos', ctrl.historial);
router.post('/movimientos', permitirRoles('admin', 'inventario'), ctrl.registrarMovimiento);
router.get('/danado', ctrl.listarDanado);
router.post('/danado', permitirRoles('admin', 'inventario'), ctrl.moverADanado);
router.post(
  '/transferencias',
  permitirRoles('admin', 'inventario'),
  ctrl.transferirStock
);
router.get('/stock-por-almacen', ctrl.listarStockPorAlmacen);
router.get(
  '/disponibilidad-ventas',
  ctrl.disponibilidadVentas
);


module.exports = router;


