import fs from 'fs';
import path from 'path';

const srcDir = './src';

function searchFile(filePath, query) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.toLowerCase().includes(query.toLowerCase())) {
    console.log(`Match in: ${filePath}`);
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (line.toLowerCase().includes(query.toLowerCase())) {
        console.log(`  Line ${idx + 1}: ${line.trim()}`);
      }
    });
  }
}

function traverse(dir, query) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      traverse(fullPath, query);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      searchFile(fullPath, query);
    }
  });
}

const query = process.argv[2] || 'group';
console.log(`Searching for "${query}"...`);
traverse(srcDir, query);
