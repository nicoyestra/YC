-- YC System v1.7 - Módulo de Presupuestos
-- Ejecutar una sola vez sobre la base existente.

CREATE TABLE IF NOT EXISTS presupuestos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero VARCHAR(30) UNIQUE NOT NULL,
    cliente_id INT NOT NULL,
    fecha DATE NOT NULL,
    valido_hasta DATE NULL,
    estado ENUM('borrador','enviado','aceptado','rechazado','vencido') NOT NULL DEFAULT 'borrador',
    observaciones TEXT NULL,
    subtotal DECIMAL(14,2) NOT NULL DEFAULT 0,
    descuento_total DECIMAL(14,2) NOT NULL DEFAULT 0,
    impuestos DECIMAL(14,2) NOT NULL DEFAULT 0,
    total DECIMAL(14,2) NOT NULL DEFAULT 0,
    orden_venta_id INT NULL,
    usuario_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_presupuestos_cliente (cliente_id),
    INDEX idx_presupuestos_estado (estado),
    INDEX idx_presupuestos_fecha (fecha),
    CONSTRAINT fk_presupuestos_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id),
    CONSTRAINT fk_presupuestos_orden_venta FOREIGN KEY (orden_venta_id) REFERENCES ordenes_venta(id) ON DELETE SET NULL,
    CONSTRAINT fk_presupuestos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS detalle_presupuestos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    presupuesto_id INT NOT NULL,
    producto_id INT NOT NULL,
    cantidad DECIMAL(12,3) NOT NULL,
    precio_unitario DECIMAL(14,2) NOT NULL,
    descuento_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 0,
    iva_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 21,
    subtotal_bruto DECIMAL(14,2) NOT NULL DEFAULT 0,
    descuento_importe DECIMAL(14,2) NOT NULL DEFAULT 0,
    subtotal_neto DECIMAL(14,2) NOT NULL DEFAULT 0,
    impuestos DECIMAL(14,2) NOT NULL DEFAULT 0,
    total DECIMAL(14,2) NOT NULL DEFAULT 0,
    CONSTRAINT fk_detalle_presupuesto FOREIGN KEY (presupuesto_id) REFERENCES presupuestos(id) ON DELETE CASCADE,
    CONSTRAINT fk_detalle_presupuesto_producto FOREIGN KEY (producto_id) REFERENCES productos(id)
);
