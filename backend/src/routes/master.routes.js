const express = require('express');

const {
  loginMaster,
  perfilMaster,
} = require('../controllers/masterAuth.controller');

const {
  listarEmpresas,
  resumenMaster,
  crearEmpresa,
  obtenerEmpresa,
  actualizarEmpresa,
  restablecerPasswordAdmin,
} = require('../controllers/masterEmpresas.controller');

const {
  verificarMaster,
} = require('../middlewares/masterAuth.middleware');

const router = express.Router();

// =========================================================
// LOGIN MASTER
// =========================================================

router.post('/login', loginMaster);

// =========================================================
// TODO LO DE ABAJO REQUIERE TOKEN MASTER
// =========================================================

router.get('/perfil', verificarMaster, perfilMaster);

router.get('/resumen', verificarMaster, resumenMaster);

// Empresas
router.get('/empresas', verificarMaster, listarEmpresas);
router.post('/empresas', verificarMaster, crearEmpresa);
router.get('/empresas/:id', verificarMaster, obtenerEmpresa);
router.put('/empresas/:id', verificarMaster, actualizarEmpresa);
router.post('/empresas/:id/restablecer-admin', verificarMaster, restablecerPasswordAdmin);

module.exports = router;