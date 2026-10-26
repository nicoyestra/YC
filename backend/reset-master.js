
const readline = require('node:readline/promises');
const bcrypt = require('bcryptjs');
const db = require('./src/config/db');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main() {
  try {
    console.log('Base maestra:', process.env.MASTER_DB_NAME || 'yc_master');

    const email = 'admin@ycsystem.com';
    const password = await rl.question(
      'Ingresá una contraseña nueva (mínimo 12 caracteres): '
    );

    if (password.length < 12) {
      throw new Error('La contraseña debe tener al menos 12 caracteres.');
    }

    const hash = await bcrypt.hash(password, 12);

    const [result] = await db.masterPool.execute(
      `UPDATE usuarios_master
       SET password_hash = ?
       WHERE email = ? AND activo = 1`,
      [hash, email]
    );

    if (result.affectedRows !== 1) {
      throw new Error(
        'No se actualizó exactamente un usuario. Revisá el correo y el estado.'
      );
    }

    const [rows] = await db.masterPool.execute(
      `SELECT password_hash
       FROM usuarios_master
       WHERE email = ? AND activo = 1`,
      [email]
    );

    const valid = rows.length === 1 &&
      await bcrypt.compare(password, rows[0].password_hash);

    if (!valid) {
      throw new Error('No se pudo verificar la contraseña guardada.');
    }

    console.log('Contraseña máster actualizada y verificada.');
  } finally {
    rl.close();
    await db.masterPool.end();
    process.exitCode = 0;
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exitCode = 1;
});
