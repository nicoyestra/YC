const express = require('express');
const router = express.Router();
const { login, registrar } = require('../controllers/auth.controller');
const { verificarToken, permitirRoles } = require('../middlewares/auth.middleware');

router.post('/login', login);
// Solo un admin ya logueado puede crear nuevos usuarios
router.post('/registrar', verificarToken, permitirRoles('admin'), registrar);

module.exports = router;
