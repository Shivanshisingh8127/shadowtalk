import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uyfcvquwmmvphiezvwvz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5ZmN2cXV3bW12cGhpZXp2d3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMTE2NTYsImV4cCI6MjA5MjY4NzY1Nn0.TP-ekZJOe4L54kPNU4BespFTpmJZN5mzBBTMBuEJFK4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const sql = `
    CREATE OR REPLACE FUNCTION delete_group_securely(group_id TEXT, caller_id TEXT)
    RETURNS VOID AS $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM chats 
        WHERE chat_id = group_id 
          AND owner_id = caller_id 
          AND (chat_data->>'adminId') = caller_id
      ) THEN
        DELETE FROM chats WHERE chat_id = group_id;
        DELETE FROM messages WHERE chat_id = group_id;
      ELSE
        RAISE EXCEPTION 'Only the group admin can delete the group.';
      END IF;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;

  console.log('Attempting to create secure RPC...');
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  console.log('Result:', { data, error });
}

run();
