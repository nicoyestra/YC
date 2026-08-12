-- =========================================================
-- YC SYSTEM v1.8.2
-- Gestión de abastecimiento de órdenes de venta
-- =========================================================

-- Cantidad efectivamente asignada a cada ítem del pedido.
ALTER TABLE detalle_ordenes_venta
ADD COLUMN cantidad_asignada INT NOT NULL DEFAULT 0
AFTER cantidad;

-- Índice para acelerar la búsqueda de pedidos pendientes
-- por producto durante la asignación automática FIFO.
CREATE INDEX idx_detalle_venta_producto_asignacion
ON detalle_ordenes_venta (producto_id, cantidad_asignada);

-- Las órdenes ya confirmadas o entregadas se consideran
-- completamente abastecidas porque el stock ya fue descontado.
UPDATE detalle_ordenes_venta dov
INNER JOIN ordenes_venta ov
  ON ov.id = dov.orden_venta_id
SET dov.cantidad_asignada = dov.cantidad
WHERE ov.estado IN ('confirmada', 'entregada');

-- Las órdenes pendientes y canceladas comienzan sin asignación.
UPDATE detalle_ordenes_venta dov
INNER JOIN ordenes_venta ov
  ON ov.id = dov.orden_venta_id
SET dov.cantidad_asignada = 0
WHERE ov.estado IN ('pendiente', 'cancelada');