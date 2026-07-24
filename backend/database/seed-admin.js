// Ejecutar una sola vez después de crear la base de datos:
// node database/seed-admin.js
const bcrypt = require('bcryptjs');
const pool = require('../src/config/db');
require('dotenv').config();

async function crearAdmin() {
  const email = 'admin@empresa.com';
  const password = 'admin123'; // cambiar apenas se pueda entrar al sistema
  const nombre_usuario = 'admin';

  try {
    const [rolRows] = await pool.query("SELECT id FROM roles WHERE nombre = 'admin'");
    if (!rolRows[0]) {
      console.error('No se encontró el rol admin. ¿Corriste schema.sql primero?');
      process.exit(1);
    }

    const password_hash = await bcrypt.hash(password, 10);

    await pool.query(
      'INSERT INTO usuarios (nombre_usuario, email, password_hash, rol_id) VALUES (?, ?, ?, ?)',
      [nombre_usuario, email, password_hash, rolRows[0].id]
    );

    console.log('Usuario admin creado con éxito:');
    console.log(`  Email: ${email}`);
    console.log(`  Password: ${password}`);
    console.log('  (Cambiá esta contraseña apenas entres al sistema)');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      console.log('El usuario admin ya existe.');
    } else {
      console.error('Error al crear admin:', err);
    }
  } finally {
    process.exit(0);
  }
}

crearAdmin();
