-- =========================================================
-- MIGRACIÓN v3 — Ejecutar sobre la base ya existente
-- =========================================================
USE erp_db;

-- ---------- DEVOLUCIONES / NOTAS DE CRÉDITO ----------
CREATE TABLE IF NOT EXISTS devoluciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero VARCHAR(30) UNIQUE NOT NULL,
    cliente_id INT NOT NULL,
    orden_venta_id INT NULL,
    almacen_id INT NOT NULL,
    motivo VARCHAR(255) NOT NULL,
    fecha DATE NOT NULL,
    subtotal DECIMAL(14,2) NOT NULL DEFAULT 0,
    nota_credito_generada BOOLEAN DEFAULT FALSE,
    usuario_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
    FOREIGN KEY (orden_venta_id) REFERENCES ordenes_venta(id) ON DELETE SET NULL,
    FOREIGN KEY (almacen_id) REFERENCES almacenes(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS detalle_devoluciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    devolucion_id INT NOT NULL,
    producto_id INT NOT NULL,
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(12,2) NOT NULL,
    subtotal DECIMAL(14,2) NOT NULL,
    FOREIGN KEY (devolucion_id) REFERENCES devoluciones(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
);

CREATE TABLE IF NOT EXISTS notas_credito (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero VARCHAR(30) UNIQUE NOT NULL,
    factura_id INT NOT NULL,
    devolucion_id INT NOT NULL,
    cliente_id INT NOT NULL,
    fecha_emision DATE NOT NULL,
    subtotal DECIMAL(14,2) NOT NULL,
    impuestos DECIMAL(14,2) NOT NULL,
    total DECIMAL(14,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (factura_id) REFERENCES facturas(id),
    FOREIGN KEY (devolucion_id) REFERENCES devoluciones(id),
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

-- ---------- INVENTARIO NO UTILIZABLE (dañado/con fallas) ----------
CREATE TABLE IF NOT EXISTS stock_danado (
    id INT AUTO_INCREMENT PRIMARY KEY,
    producto_id INT NOT NULL,
    almacen_id INT NOT NULL,
    cantidad INT NOT NULL DEFAULT 0,
    UNIQUE KEY unico_stock_danado (producto_id, almacen_id),
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
    FOREIGN KEY (almacen_id) REFERENCES almacenes(id) ON DELETE CASCADE
);

ALTER TABLE movimientos_inventario
  MODIFY COLUMN tipo ENUM('entrada','salida','ajuste','merma') NOT NULL;
