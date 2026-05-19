import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });
dotenv.config();

console.log('Environment variables in server:');
console.log('PORT:', process.env.PORT);
console.log('SUPABASE_URL:', process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'EXISTS' : 'NOT FOUND');
console.log('SUPABASE_KEY / ANON_KEY:', process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY ? 'EXISTS' : 'NOT FOUND');
