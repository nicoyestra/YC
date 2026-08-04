const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/devoluciones.controller');
const { verificarToken, permitirRoles } = require('../middlewares/auth.middleware');

router.use(verificarToken);

router.get('/', ctrl.listar);
router.get('/:id', ctrl.obtener);
router.post('/', permitirRoles('admin', 'ventas'), ctrl.crear);

module.exports = router;
