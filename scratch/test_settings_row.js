import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uyfcvquwmmvphiezvwvz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5ZmN2cXV3bW12cGhpZXp2d3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMTE2NTYsImV4cCI6MjA5MjY4NzY1Nn0.TP-ekZJOe4L54kPNU4BespFTpmJZN5mzBBTMBuEJFK4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const testUserId = 't1'; // Use an existing user id
  console.log('Inserting custom settings row for user t1...');
  const { data, error } = await supabase
    .from('chats')
    .upsert({
      owner_id: testUserId,
      chat_id: 'settings_privacy',
      chat_data: { readReceipts: false, lastUpdated: Date.now() }
    }, { onConflict: 'owner_id, chat_id' })
    .select();

  if (error) {
    console.error('Insert failed:', error);
  } else {
    console.log('Insert succeeded! Row:', data);
    
    // Now try fetching it
    console.log('Fetching custom settings row...');
    const { data: fetchResult, error: fetchError } = await supabase
      .from('chats')
      .select('*')
      .eq('owner_id', testUserId)
      .eq('chat_id', 'settings_privacy')
      .single();
      
    if (fetchError) {
      console.error('Fetch failed:', fetchError);
    } else {
      console.log('Fetch succeeded! Row:', fetchResult);
    }
  }
}

test();
