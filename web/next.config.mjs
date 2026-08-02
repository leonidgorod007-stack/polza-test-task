import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // pg — серверная библиотека, не тащим её в клиентский бандл.
  serverExternalPackages: ['pg'],
  // В репозитории два package.json (корень и web/) — явно указываем корень
  // трассировки, чтобы Next не путался с выбором workspace root.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
