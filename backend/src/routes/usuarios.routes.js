const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/usuarios.controller');
const { verificarToken, permitirRoles } = require('../middlewares/auth.middleware');

router.use(verificarToken, permitirRoles('admin'));

router.get('/', ctrl.listar);
router.get('/opciones', ctrl.opciones);
router.post('/', ctrl.crear);
router.put('/:id', ctrl.actualizar);
router.patch('/:id/estado', ctrl.cambiarEstado);
router.patch('/:id/password', ctrl.cambiarPassword);

module.exports = router;
