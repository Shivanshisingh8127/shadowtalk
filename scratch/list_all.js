import fs from 'fs';

console.log('Root directory files (all):');
console.log(fs.readdirSync('.'));

console.log('Server directory files (all):');
if (fs.existsSync('./server')) {
  console.log(fs.readdirSync('./server'));
}
