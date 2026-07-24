const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/empleados.controller');
const { verificarToken, permitirRoles } = require('../middlewares/auth.middleware');

router.use(verificarToken);

router.get('/', permitirRoles('admin', 'rrhh'), ctrl.listar);
router.get('/:id', permitirRoles('admin', 'rrhh'), ctrl.obtener);
router.post('/', permitirRoles('admin', 'rrhh'), ctrl.crear);
router.put('/:id', permitirRoles('admin', 'rrhh'), ctrl.actualizar);
router.delete('/:id', permitirRoles('admin', 'rrhh'), ctrl.eliminar);

module.exports = router;
