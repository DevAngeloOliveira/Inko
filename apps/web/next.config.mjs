import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.resolve(directory, '../..'),
};

export default nextConfig;
