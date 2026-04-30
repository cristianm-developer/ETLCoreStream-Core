import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');
const srcIndexDts = path.join(distDir, 'src', 'index.d.ts');
const distIndexDts = path.join(distDir, 'index.d.ts');

try {
  let content = fs.readFileSync(srcIndexDts, 'utf-8');
  
  // Update paths to point to src subdirectory
  content = content
    .replace(/export \* from '\.\/core\/index'/g, "export * from './src/core/index'")
    .replace(/export \* from '\.\/shared\/index'/g, "export * from './src/shared/index'")
    .replace(/export \* from '\.\/examples\/index'/g, "export * from './src/examples/index'");
  
  fs.writeFileSync(distIndexDts, content, 'utf-8');
  console.log('✓ Successfully created dist/index.d.ts');
} catch (error) {
  console.error('✗ Error creating dist/index.d.ts:', error.message);
  process.exit(1);
}
