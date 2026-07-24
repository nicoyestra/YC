# ERP - Sistema de Gestión

Sistema ERP con 5 módulos: **Inventario, Compras, Ventas, Facturación y RRHH**.
Backend en Node.js + Express + MySQL. Frontend en React (Vite).

## Estructura

```
erp-system/
├── backend/
│   ├── database/
│   │   ├── schema.sql       ← script para crear la base de datos completa
│   │   └── seed-admin.js    ← crea el primer usuario administrador
│   ├── src/
│   │   ├── config/db.js
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   └── routes/
│   ├── server.js
│   └── package.json
└── frontend/
    ├── src/
    │   ├── api/
    │   ├── context/
    │   ├── components/
    │   └── pages/
    └── package.json
```

## 1. Requisitos previos

- Node.js 18 o superior
- MySQL 8 (o MariaDB) corriendo localmente

## 2. Base de datos

```bash
mysql -u root -p < backend/database/schema.sql
```

Esto crea la base `erp_db` con todas las tablas de los 5 módulos y datos iniciales (roles y un almacén).

## 3. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Editá `.env` con tus credenciales de MySQL y un `JWT_SECRET` propio. Después:

```bash
node database/seed-admin.js   # crea el usuario admin (una sola vez)
npm run dev                    # o "npm start" en producción
```

El backend queda en `http://localhost:4000`. Usuario inicial:
- **Email:** admin@empresa.com
- **Password:** admin123 (cambiala apenas entres)

## 4. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

El frontend queda en `http://localhost:5173`.

## 5. Roles del sistema

- `admin` → acceso total
- `ventas`, `compras`, `inventario`, `rrhh` → acceso a su módulo correspondiente

Un admin puede crear más usuarios desde `POST /api/auth/registrar`.

## Estado actual de cada módulo

| Módulo | Backend | Frontend |
|---|---|---|
| Inventario | Completo (productos, stock, movimientos, alertas) | Completo |
| Compras | Completo (proveedores, órdenes, recepción con actualización de stock) | Completo (alta de proveedores y órdenes con ítems, ver detalle, recibir orden) |
| Ventas | Completo (clientes, órdenes con descuento automático de stock) | Completo (alta de clientes y órdenes con ítems, aviso si excede stock disponible) |
| Facturación | Completo (generar desde orden de venta, pagos) | Completo (generar factura desde orden de venta, registrar pagos) |
| RRHH | Completo (CRUD de empleados) | Completo |

## Próximos pasos sugeridos

- Reportes (ventas por período, valorización de inventario, etc.)
- Gestión de usuarios desde la interfaz (hoy es solo por API)
- Paginación en listados largos
- Anular/cancelar órdenes y facturas
