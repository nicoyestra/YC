const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/notificaciones.controller');
const { verificarToken } = require('../middlewares/auth.middleware');
router.use(verificarToken);
router.get('/', ctrl.listar);
router.post('/leer-todas', ctrl.marcarTodas);
router.post('/:clave/leer', ctrl.marcarLeida);
module.exports = router;
