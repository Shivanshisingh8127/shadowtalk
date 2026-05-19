import fs from 'fs';

console.log('Checking server/.env file...');
if (fs.existsSync('server/.env')) {
  console.log('server/.env exists!');
  const content = fs.readFileSync('server/.env', 'utf8');
  const lines = content.split('\n');
  lines.forEach(line => {
    const parts = line.split('=');
    if (parts[0]) {
      console.log(`Key found: ${parts[0].trim()}`);
    }
  });
} else {
  console.log('server/.env does NOT exist.');
}

console.log('Checking root .env file...');
if (fs.existsSync('.env')) {
  console.log('root .env exists!');
  const content = fs.readFileSync('.env', 'utf8');
  const lines = content.split('\n');
  lines.forEach(line => {
    const parts = line.split('=');
    if (parts[0]) {
      console.log(`Key found: ${parts[0].trim()}`);
    }
  });
} else {
  console.log('root .env does NOT exist.');
}
