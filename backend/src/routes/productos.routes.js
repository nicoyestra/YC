const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/productos.controller');
const { verificarToken, permitirRoles } = require('../middlewares/auth.middleware');

router.use(verificarToken);

router.get('/', ctrl.listar);
router.post('/importar', permitirRoles('admin', 'inventario', 'compras'), ctrl.importarCatalogo);
router.get('/bajo-stock', ctrl.productosBajoStock);
router.get('/precios-oferta', ctrl.listarPreciosOferta);
router.get('/codigo/:codigo', ctrl.buscarPorCodigoBarras);
router.get('/:id', ctrl.obtener);
router.post('/', permitirRoles('admin', 'inventario', 'compras'), ctrl.crear);
router.put('/:id', permitirRoles('admin', 'inventario', 'compras'), ctrl.actualizar);
router.delete('/:id', permitirRoles('admin', 'inventario'), ctrl.eliminar);

module.exports = router;
