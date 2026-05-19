import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uyfcvquwmmvphiezvwvz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5ZmN2cXV3bW12cGhpZXp2d3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMTE2NTYsImV4cCI6MjA5MjY4NzY1Nn0.TP-ekZJOe4L54kPNU4BespFTpmJZN5mzBBTMBuEJFK4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
  console.log('--- Inspecting Database Policies & Schema ---');
  // Querypg_policies
  const { data, error } = await supabase.rpc('inspect_policies');
  if (error) {
    console.warn('Could not run inspect_policies RPC directly. Trying to inspect standard tables...');
  } else {
    console.log('Policies:', data);
  }

  // Let's fetch one group chat row to inspect structure
  const { data: chats, error: chatsErr } = await supabase
    .from('chats')
    .select('*')
    .limit(10);
  
  if (chatsErr) {
    console.error('Chats query failed:', chatsErr);
  } else {
    console.log('Found', chats.length, 'chats.');
    chats.forEach(c => {
      if (c.chat_data?.type === 'group') {
        console.log('Group chat row sample:', JSON.stringify(c, null, 2));
      }
    });
  }
}

inspect();
