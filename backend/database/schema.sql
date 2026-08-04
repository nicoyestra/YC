-- =========================================================
-- ERP - Esquema de Base de Datos (MySQL) - v2
-- Módulos: Usuarios/RRHH, Artículos/Inventario, Compras, Ventas,
--          Facturación, Centro de Costos (Gastos), Logística
-- =========================================================

CREATE DATABASE IF NOT EXISTS erp_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE erp_db;

-- =========================================================
-- MÓDULO: RRHH / USUARIOS
-- =========================================================

CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion VARCHAR(255)
);

CREATE TABLE empleados (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    dni VARCHAR(20) UNIQUE,
    email VARCHAR(150) UNIQUE NOT NULL,
    telefono VARCHAR(30),
    puesto VARCHAR(100),
    departamento VARCHAR(100),
    fecha_ingreso DATE,
    salario DECIMAL(12,2),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empleado_id INT NULL,
    nombre_usuario VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol_id INT NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    ultimo_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE SET NULL,
    FOREIGN KEY (rol_id) REFERENCES roles(id)
);

-- =========================================================
-- MÓDULO: PROVEEDORES (se declara antes que productos porque
-- un artículo puede tener un proveedor habitual)
-- =========================================================

CREATE TABLE proveedores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    cuit VARCHAR(30),
    email VARCHAR(150),
    telefono VARCHAR(30),
    direccion VARCHAR(255),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- MÓDULO: ARTÍCULOS / INVENTARIO
-- =========================================================

CREATE TABLE categorias_producto (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255)
);

CREATE TABLE almacenes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    ubicacion VARCHAR(255)
);

-- "productos" es la base de artículos: datos maestros (SKU, código de
-- barras, descripción, precios, IVA, proveedor habitual). El STOCK en sí
-- vive aparte, en la tabla stock/movimientos_inventario.
CREATE TABLE productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(50) UNIQUE NOT NULL,
    codigo_barras VARCHAR(50) UNIQUE NULL,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    categoria_id INT,
    proveedor_id INT NULL,
    precio_costo DECIMAL(12,2) NOT NULL DEFAULT 0,
    precio_venta DECIMAL(12,2) NOT NULL DEFAULT 0,
    iva_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 21.00,
    stock_minimo INT DEFAULT 0,
    unidad_medida VARCHAR(20) DEFAULT 'unidad',
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (categoria_id) REFERENCES categorias_producto(id) ON DELETE SET NULL,
    FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE SET NULL
);

CREATE TABLE stock (
    id INT AUTO_INCREMENT PRIMARY KEY,
    producto_id INT NOT NULL,
    almacen_id INT NOT NULL,
    cantidad INT NOT NULL DEFAULT 0,
    UNIQUE KEY unico_stock (producto_id, almacen_id),
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
    FOREIGN KEY (almacen_id) REFERENCES almacenes(id) ON DELETE CASCADE
);

CREATE TABLE movimientos_inventario (
    id INT AUTO_INCREMENT PRIMARY KEY,
    producto_id INT NOT NULL,
    almacen_id INT NOT NULL,
    tipo ENUM('entrada','salida','ajuste','merma') NOT NULL,
    cantidad INT NOT NULL,
    motivo VARCHAR(255),
    referencia_tipo VARCHAR(50),
    referencia_id INT NULL,
    usuario_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (producto_id) REFERENCES productos(id),
    FOREIGN KEY (almacen_id) REFERENCES almacenes(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- =========================================================
-- MÓDULO: COMPRAS
-- =========================================================

CREATE TABLE ordenes_compra (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero VARCHAR(30) UNIQUE NOT NULL,
    proveedor_id INT NOT NULL,
    almacen_id INT NOT NULL,
    estado ENUM('borrador','enviada','parcial','recibida','cancelada') DEFAULT 'borrador',
    observaciones TEXT NULL,
    fecha DATE NOT NULL,
    fecha_recepcion DATE NULL,
    total DECIMAL(14,2) DEFAULT 0,
    usuario_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proveedor_id) REFERENCES proveedores(id),
    FOREIGN KEY (almacen_id) REFERENCES almacenes(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE detalle_ordenes_compra (
    id INT AUTO_INCREMENT PRIMARY KEY,
    orden_compra_id INT NOT NULL,
    producto_id INT NOT NULL,
    cantidad INT NOT NULL,
    cantidad_recibida INT NOT NULL DEFAULT 0,
    precio_unitario DECIMAL(12,2) NOT NULL,
    subtotal DECIMAL(14,2) NOT NULL,
    FOREIGN KEY (orden_compra_id) REFERENCES ordenes_compra(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
);

-- =========================================================
-- MÓDULO: VENTAS
-- =========================================================

CREATE TABLE clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    cuit_dni VARCHAR(30),
    email VARCHAR(150),
    telefono VARCHAR(30),
    direccion VARCHAR(255),
    codigo_postal VARCHAR(20),
    es_externo BOOLEAN NOT NULL DEFAULT FALSE,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- estado: 'pendiente' = cargada pero sin cerrar (no descontó stock todavía,
-- cualquier otro sector la puede retomar y cerrar); 'confirmada' = cerrada,
-- ya descontó stock; 'entregada'/'cancelada' según corresponda.
CREATE TABLE ordenes_venta (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero VARCHAR(30) UNIQUE NOT NULL,
    cliente_id INT NOT NULL,
    almacen_id INT NOT NULL,
    estado ENUM('pendiente','confirmada','entregada','cancelada') DEFAULT 'pendiente',
    fecha DATE NOT NULL,
    total DECIMAL(14,2) DEFAULT 0,
    usuario_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
    FOREIGN KEY (almacen_id) REFERENCES almacenes(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE detalle_ordenes_venta (
    id INT AUTO_INCREMENT PRIMARY KEY,
    orden_venta_id INT NOT NULL,
    producto_id INT NOT NULL,
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(12,2) NOT NULL,
    subtotal DECIMAL(14,2) NOT NULL,
    FOREIGN KEY (orden_venta_id) REFERENCES ordenes_venta(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
);

-- =========================================================
-- MÓDULO: FACTURACIÓN
-- =========================================================

CREATE TABLE facturas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero VARCHAR(30) UNIQUE NOT NULL,
    tipo ENUM('A','B','C') DEFAULT 'B',
    condicion_pago ENUM('contado','cuenta_corriente','cheque') NOT NULL DEFAULT 'contado',
    orden_venta_id INT NULL,
    cliente_id INT NOT NULL,
    fecha_emision DATE NOT NULL,
    fecha_vencimiento DATE,
    subtotal DECIMAL(14,2) NOT NULL DEFAULT 0,
    impuestos DECIMAL(14,2) NOT NULL DEFAULT 0,
    total DECIMAL(14,2) NOT NULL DEFAULT 0,
    estado ENUM('pendiente','pagada','anulada','vencida') DEFAULT 'pendiente',
    usuario_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (orden_venta_id) REFERENCES ordenes_venta(id),
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE detalle_facturas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    factura_id INT NOT NULL,
    producto_id INT NOT NULL,
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(12,2) NOT NULL,
    subtotal DECIMAL(14,2) NOT NULL,
    FOREIGN KEY (factura_id) REFERENCES facturas(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
);

CREATE TABLE pagos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    factura_id INT NOT NULL,
    monto DECIMAL(14,2) NOT NULL,
    metodo_pago ENUM('efectivo','transferencia','tarjeta','cheque') NOT NULL,
    fecha_pago DATE NOT NULL,
    referencia VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (factura_id) REFERENCES facturas(id) ON DELETE CASCADE
);

-- =========================================================
-- MÓDULO: CENTRO DE COSTOS (GASTOS)
-- =========================================================

CREATE TABLE gastos (
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

-- =========================================================
-- MÓDULO: LOGÍSTICA
-- =========================================================

CREATE TABLE logistica (
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


-- =========================================================
-- MÓDULO: DEVOLUCIONES / NOTAS DE CRÉDITO
-- =========================================================

CREATE TABLE devoluciones (
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

CREATE TABLE detalle_devoluciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    devolucion_id INT NOT NULL,
    producto_id INT NOT NULL,
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(12,2) NOT NULL,
    subtotal DECIMAL(14,2) NOT NULL,
    FOREIGN KEY (devolucion_id) REFERENCES devoluciones(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
);

CREATE TABLE notas_credito (
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

-- =========================================================
-- MÓDULO: INVENTARIO NO UTILIZABLE (dañado/con fallas)
-- =========================================================

CREATE TABLE stock_danado (
    id INT AUTO_INCREMENT PRIMARY KEY,
    producto_id INT NOT NULL,
    almacen_id INT NOT NULL,
    cantidad INT NOT NULL DEFAULT 0,
    UNIQUE KEY unico_stock_danado (producto_id, almacen_id),
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
    FOREIGN KEY (almacen_id) REFERENCES almacenes(id) ON DELETE CASCADE
);

-- =========================================================
-- DATOS INICIALES
-- =========================================================

INSERT INTO roles (nombre, descripcion) VALUES
('admin', 'Acceso total al sistema'),
('ventas', 'Gestión de clientes y ventas'),
('compras', 'Gestión de proveedores y compras'),
('inventario', 'Gestión de stock y almacenes'),
('rrhh', 'Gestión de empleados');

INSERT INTO almacenes (nombre, ubicacion) VALUES
('Depósito Central', 'Casa Central'),
('Mostrador', 'Local / atención al público'),
('Otros', 'Ubicación variable');
