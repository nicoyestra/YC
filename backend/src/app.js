const express = require('express');
const cors = require('cors');
require('dotenv').config();


const authRoutes = require('./routes/auth.routes');
const productosRoutes = require('./routes/productos.routes');
const inventarioRoutes = require('./routes/inventario.routes');
const comprasRoutes = require('./routes/compras.routes');
const ventasRoutes = require('./routes/ventas.routes');
const facturacionRoutes = require('./routes/facturacion.routes');
const empleadosRoutes = require('./routes/empleados.routes');
const gastosRoutes = require('./routes/gastos.routes');
const logisticaRoutes = require('./routes/logistica.routes');
const estadisticasRoutes = require('./routes/estadisticas.routes');
const devolucionesRoutes = require('./routes/devoluciones.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const notificacionesRoutes = require('./routes/notificaciones.routes');
const busquedaRoutes = require('./routes/busqueda.routes');
const presupuestosRoutes = require('./routes/presupuestos.routes');
const masterRoutes = require('./routes/master.routes');

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/inventario', inventarioRoutes);
app.use('/api/compras', comprasRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/facturacion', facturacionRoutes);
app.use('/api/empleados', empleadosRoutes);
app.use('/api/gastos', gastosRoutes);
app.use('/api/logistica', logisticaRoutes);
app.use('/api/estadisticas', estadisticasRoutes);
app.use('/api/devoluciones', devolucionesRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/busqueda', busquedaRoutes);
app.use('/api/presupuestos', presupuestosRoutes);
app.use('/api/master', masterRoutes);

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Manejo de errores generales
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

module.exports = app;
