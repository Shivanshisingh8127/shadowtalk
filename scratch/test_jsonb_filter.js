import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uyfcvquwmmvphiezvwvz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5ZmN2cXV3bW12cGhpZXp2d3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMTE2NTYsImV4cCI6MjA5MjY4NzY1Nn0.TP-ekZJOe4L54kPNU4BespFTpmJZN5mzBBTMBuEJFK4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log('Testing JSONB filter query...');
  const { data, error } = await supabase
    .from('chats')
    .select('chat_id, chat_data')
    .filter('chat_data->>adminId', 'eq', 'pp1');

  if (error) {
    console.error('Filter query failed:', error);
  } else {
    console.log('Filter query succeeded! Found', data.length, 'chats.');
    data.forEach(c => {
      console.log(` - Chat ID: ${c.chat_id}, Admin ID: ${c.chat_data?.adminId}`);
    });
  }
}

test();
