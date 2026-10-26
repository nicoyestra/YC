const express = require('express');
const router = express.Router();
const { login, registrar, heartbeat, logout } = require('../controllers/auth.controller');
const { verificarToken, permitirRoles } = require('../middlewares/auth.middleware');

router.post('/login', login);
router.post('/heartbeat', verificarToken, heartbeat);
router.post('/logout', verificarToken, logout);
// Solo un admin ya logueado puede crear nuevos usuarios
router.post('/registrar', verificarToken, permitirRoles('admin'), registrar);

module.exports = router;
