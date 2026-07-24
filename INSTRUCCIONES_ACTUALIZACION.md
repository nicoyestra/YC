# Actualización ERP — pedidos de ajuste (18 puntos)

Este paquete trae **solo los archivos nuevos o modificados**, manteniendo la misma
estructura de carpetas que tu proyecto (`backend/...`, `frontend/...`). Pisá cada
archivo en la ubicación correspondiente de tu proyecto real.

## 1. Base de datos (hacelo primero)

**No corras `schema.sql`** (te borraría los datos que ya tenés cargados). Corré la
migración, que solo agrega columnas y tablas nuevas:

```bash
mysql -u root -p erp_db < backend/database/migration_v2.sql
```

(El `schema.sql` de este paquete también está actualizado, por si en algún momento
necesitás armar una base nueva desde cero — no lo uses sobre la que ya tenés andando.)

## 2. Backend

Copiá/pisá estos archivos en tu proyecto:

```
backend/src/app.js
backend/src/controllers/clientes.controller.js
backend/src/controllers/facturas.controller.js
backend/src/controllers/ordenesCompra.controller.js
backend/src/controllers/ordenesVenta.controller.js
backend/src/controllers/productos.controller.js
backend/src/controllers/proveedores.controller.js
backend/src/controllers/estadisticas.controller.js   ← nuevo
backend/src/controllers/gastos.controller.js          ← nuevo
backend/src/controllers/logistica.controller.js       ← nuevo
backend/src/routes/compras.routes.js
backend/src/routes/productos.routes.js
backend/src/routes/ventas.routes.js
backend/src/routes/estadisticas.routes.js             ← nuevo
backend/src/routes/gastos.routes.js                   ← nuevo
backend/src/routes/logistica.routes.js                ← nuevo
```

No hace falta `npm install` de nuevo: no agregué dependencias nuevas.

## 3. Frontend

Copiá/pisá estos archivos:

```
frontend/src/App.jsx
frontend/src/components/Layout.jsx
frontend/src/pages/Compras.jsx
frontend/src/pages/Facturacion.jsx
frontend/src/pages/Inventario.jsx
frontend/src/pages/Ventas.jsx
frontend/src/pages/Articulos.jsx      ← nuevo
frontend/src/pages/Clientes.jsx       ← nuevo
frontend/src/pages/Estadisticas.jsx   ← nuevo
frontend/src/pages/Gastos.jsx         ← nuevo
frontend/src/pages/Logistica.jsx      ← nuevo
```

## 4. Reiniciar

Reiniciá el backend (`npm run dev` en `backend/`) y el frontend (`npm run dev` en
`frontend/`). En el menú lateral deberían aparecerte ahora: Artículos, Clientes,
Logística, Centro de costos y Estadísticas, además de los cambios dentro de
Inventario, Compras, Ventas y Facturación.

## Qué cambió en cada punto de tu lista

| # | Pedido | Dónde |
|---|---|---|
| 1, 3, 14 | Artículos separado, código de barras, descripción visible | `Articulos.jsx` (nuevo), `productos.controller.js` |
| 2 | Buscador de proveedores | `Compras.jsx`, `proveedores.controller.js` |
| 4 | Observaciones + recepción parcial | `Compras.jsx`, `ordenesCompra.controller.js` |
| 5 | Número de OC automático | `ordenesCompra.controller.js` (función `generarNumero`) |
| 6 | Buscador de órdenes de compra | `Compras.jsx`, `ordenesCompra.controller.js` |
| 7 | Cheque → vencimiento +60 días | `Facturacion.jsx`, `facturas.controller.js` |
| 8 | Clientes separado de Ventas | `Clientes.jsx` (nuevo), `Ventas.jsx` (sin CRUD de clientes) |
| 9 | Estadísticas con filtro de fechas | `Estadisticas.jsx` + `estadisticas.controller.js` (nuevos) |
| 10 | Venta pendiente / cierre por otro sector | `Ventas.jsx`, `ordenesVenta.controller.js` (flujo pendiente→confirmar) |
| 11, 17 | Proveedor y precio+IVA en inventario | `Inventario.jsx`, `productos.controller.js` |
| 12 | Clientes externos + fecha/hora automática | `Clientes.jsx`, `clientes.controller.js` |
| 13 | Centro de costos (gastos) | `Gastos.jsx` + `gastos.controller.js` (nuevos) |
| 15 | Almacenes Mostrador/Otros | `migration_v2.sql` (inserts) |
| 16 | Fecha automática editable en ventas | `Ventas.jsx` |
| 18 | Logística | `Logistica.jsx` + `logistica.controller.js` (nuevos) |

Dejé afuera de este paquete `frontend/src/api/client.js` porque la diferencia con
el tuyo es solo cosmética (mismo comportamiento) — no hace falta tocarlo.
