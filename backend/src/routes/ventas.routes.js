const express = require('express');
const router = express.Router();
const clientesCtrl = require('../controllers/clientes.controller');
const ordenesCtrl = require('../controllers/ordenesVenta.controller');
const { verificarToken, permitirRoles } = require('../middlewares/auth.middleware');

router.use(verificarToken);

// Clientes
router.get('/clientes', clientesCtrl.listar);
router.get('/clientes/:id', clientesCtrl.obtener);
router.post('/clientes', permitirRoles('admin', 'ventas'), clientesCtrl.crear);
router.put('/clientes/:id', permitirRoles('admin', 'ventas'), clientesCtrl.actualizar);
router.delete('/clientes/:id', permitirRoles('admin', 'ventas'), clientesCtrl.eliminar);

// Órdenes de venta
router.get('/ordenes', ordenesCtrl.listar);
router.get('/ordenes/:id', ordenesCtrl.obtener);
router.post('/ordenes', permitirRoles('admin', 'ventas'), ordenesCtrl.crear);
router.post('/ordenes/:id/confirmar', permitirRoles('admin', 'ventas', 'inventario'), ordenesCtrl.confirmar);

module.exports = router;
