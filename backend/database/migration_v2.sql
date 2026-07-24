-- =========================================================
-- MIGRACIÓN v2 — Ejecutar sobre una base erp_db ya existente
-- (no borra datos; solo agrega columnas y tablas nuevas)
-- =========================================================
USE erp_db;

-- ---------- PRODUCTOS / ARTÍCULOS ----------
ALTER TABLE productos
  ADD COLUMN codigo_barras VARCHAR(50) NULL UNIQUE AFTER sku,
  ADD COLUMN proveedor_id INT NULL AFTER categoria_id,
  ADD COLUMN iva_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 21.00 AFTER precio_venta,
  ADD CONSTRAINT fk_productos_proveedor FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE SET NULL;

-- ---------- COMPRAS ----------
ALTER TABLE ordenes_compra
  ADD COLUMN observaciones TEXT NULL AFTER estado,
  MODIFY COLUMN estado ENUM('borrador','enviada','parcial','recibida','cancelada') DEFAULT 'borrador';

ALTER TABLE detalle_ordenes_compra
  ADD COLUMN cantidad_recibida INT NOT NULL DEFAULT 0 AFTER cantidad;

-- ---------- CLIENTES ----------
ALTER TABLE clientes
  ADD COLUMN es_externo BOOLEAN NOT NULL DEFAULT FALSE AFTER activo,
  ADD COLUMN codigo_postal VARCHAR(20) NULL AFTER direccion;

-- ---------- VENTAS ----------
ALTER TABLE ordenes_venta
  MODIFY COLUMN estado ENUM('pendiente','confirmada','entregada','cancelada') DEFAULT 'pendiente';

-- ---------- FACTURACIÓN ----------
ALTER TABLE facturas
  ADD COLUMN condicion_pago ENUM('contado','cuenta_corriente','cheque') NOT NULL DEFAULT 'contado' AFTER tipo;

-- ---------- ALMACENES NUEVOS ----------
INSERT INTO almacenes (nombre, ubicacion)
SELECT 'Mostrador', 'Local / atención al público'
WHERE NOT EXISTS (SELECT 1 FROM almacenes WHERE nombre = 'Mostrador');

INSERT INTO almacenes (nombre, ubicacion)
SELECT 'Otros', 'Ubicación variable'
WHERE NOT EXISTS (SELECT 1 FROM almacenes WHERE nombre = 'Otros');

-- ---------- CENTRO DE COSTOS (GASTOS) ----------
CREATE TABLE IF NOT EXISTS gastos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    categoria VARCHAR(100) NOT NULL,
    tipo_comprobante ENUM('remito','factura','otro') DEFAULT 'factura',
    numero_comprobante VARCHAR(50),
    proveedor_id INT NULL,
    monto DECIMAL(14,2) NOT NULL,
    fecha DATE NOT NULL,
    descripcion VARCHAR(255),
    usuario_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE SET NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- ---------- LOGÍSTICA ----------
CREATE TABLE IF NOT EXISTS logistica (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tipo ENUM('despacho','retiro') NOT NULL,
    cliente_id INT NOT NULL,
    orden_venta_id INT NULL,
    direccion VARCHAR(255),
    codigo_postal VARCHAR(20),
    estado ENUM('pendiente','en_curso','completado','cancelado') DEFAULT 'pendiente',
    fecha DATE NOT NULL,
    notas VARCHAR(255),
    usuario_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
    FOREIGN KEY (orden_venta_id) REFERENCES ordenes_venta(id) ON DELETE SET NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);
