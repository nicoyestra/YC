-- YC System v1.5.1 / v1.5.2
-- Persistencia de lectura para alertas dinámicas del centro de notificaciones.
CREATE TABLE IF NOT EXISTS notificaciones_leidas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  clave VARCHAR(160) NOT NULL,
  leida_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unico_usuario_clave (usuario_id, clave),
  CONSTRAINT fk_notificaciones_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);
