const express = require('express');
const router = express.Router();
const presupuestosCtrl = require('../controllers/presupuestos.controller');
const { verificarToken, permitirRoles } = require('../middlewares/auth.middleware');

router.use(verificarToken);

router.get('/', presupuestosCtrl.listar);
router.get('/:id', presupuestosCtrl.obtener);
router.post('/', permitirRoles('admin', 'ventas'), presupuestosCtrl.crear);
router.put('/:id', permitirRoles('admin', 'ventas'), presupuestosCtrl.actualizar);
router.patch('/:id/estado', permitirRoles('admin', 'ventas'), presupuestosCtrl.cambiarEstado);

module.exports = router;
