import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uyfcvquwmmvphiezvwvz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5ZmN2cXV3bW12cGhpZXp2d3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMTE2NTYsImV4cCI6MjA5MjY4NzY1Nn0.TP-ekZJOe4L54kPNU4BespFTpmJZN5mzBBTMBuEJFK4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log('--- Chats table sample ---');
  const { data: chats, error: errChats } = await supabase.from('chats').select('*').limit(1);
  if (errChats) console.error('Chats error:', errChats);
  else console.log('Chats row keys:', Object.keys(chats[0] || {}), '\nSample chats data:', chats[0]);

  console.log('\n--- Messages table sample ---');
  const { data: messages, error: errMessages } = await supabase.from('messages').select('*').limit(1);
  if (errMessages) console.error('Messages error:', errMessages);
  else console.log('Messages row keys:', Object.keys(messages[0] || {}), '\nSample messages data:', messages[0]);

  console.log('\n--- Users table sample ---');
  const { data: users, error: errUsers } = await supabase.from('users').select('*').limit(1);
  if (errUsers) console.error('Users error:', errUsers);
  else console.log('Users row keys:', Object.keys(users[0] || {}), '\nSample users data:', users[0]);
}

check();
