import pg from 'pg';

const url = process.argv[2] || process.env.DATABASE_URL;
if (!url) { console.error('no-url'); process.exit(2); }

async function connectOk(connectionString) {
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 2500 });
  await client.connect();
  await client.query('SELECT 1');
  await client.end();
}

async function main() {
  try {
    await connectOk(url);
    console.log('OK');
    process.exit(0);
  } catch (e) {
    if (e.code === '3D000') {
      const u = new URL(url);
      const dbName = decodeURIComponent(u.pathname.replace(/^\//, ''));
      u.pathname = '/postgres';
      try {
        const admin = new pg.Client({ connectionString: u.toString(), connectionTimeoutMillis: 2500 });
        await admin.connect();
        await admin.query(`CREATE DATABASE "${dbName}"`);
        await admin.end();
        console.log('CREATED');
        process.exit(0);
      } catch {
        process.exit(1);
      }
    }
    process.exit(1);
  }
}

main();
