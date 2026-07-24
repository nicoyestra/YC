const express = require('express');
const router = express.Router();
const proveedoresCtrl = require('../controllers/proveedores.controller');
const ordenesCtrl = require('../controllers/ordenesCompra.controller');
const { verificarToken, permitirRoles } = require('../middlewares/auth.middleware');

router.use(verificarToken);

// Proveedores
router.get('/proveedores', proveedoresCtrl.listar);
router.post('/proveedores', permitirRoles('admin', 'compras'), proveedoresCtrl.crear);
router.put('/proveedores/:id', permitirRoles('admin', 'compras'), proveedoresCtrl.actualizar);
router.delete('/proveedores/:id', permitirRoles('admin', 'compras'), proveedoresCtrl.eliminar);

// Órdenes de compra
router.get('/ordenes', ordenesCtrl.listar);
router.get('/ordenes/:id', ordenesCtrl.obtener);
router.post('/ordenes', permitirRoles('admin', 'compras'), ordenesCtrl.crear);
router.put('/ordenes/:id/observaciones', permitirRoles('admin', 'compras'), ordenesCtrl.actualizarObservaciones);
router.post('/ordenes/:id/recibir', permitirRoles('admin', 'compras', 'inventario'), ordenesCtrl.recibir);

module.exports = router;
