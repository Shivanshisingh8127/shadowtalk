import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uyfcvquwmmvphiezvwvz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5ZmN2cXV3bW12cGhpZXp2d3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMTE2NTYsImV4cCI6MjA5MjY4NzY1Nn0.TP-ekZJOe4L54kPNU4BespFTpmJZN5mzBBTMBuEJFK4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const sql = `
    SELECT proname, pg_get_functiondef(p.oid) as definition
    FROM pg_proc p
    WHERE p.proname IN ('append_message_status', 'exec_sql', 'inspect_policies');
  `;
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error('Error executing query:', error);
  } else {
    data.forEach(fn => {
      console.log(`=== Function: ${fn.proname} ===`);
      console.log(fn.definition);
      console.log('\n');
    });
  }
}

run();
