import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uyfcvquwmmvphiezvwvz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5ZmN2cXV3bW12cGhpZXp2d3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMTE2NTYsImV4cCI6MjA5MjY4NzY1Nn0.TP-ekZJOe4L54kPNU4BespFTpmJZN5mzBBTMBuEJFK4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log('--- Testing RLS Policies on messages ---');
  
  // 1. Insert test message as User A ('sender-test') to User B ('receiver-test')
  const testMsgId = 'test_' + Date.now();
  console.log('Inserting test message:', testMsgId);
  
  const { data: insertData, error: insertErr } = await supabase
    .from('messages')
    .insert({
      id: testMsgId,
      chat_id: 'receiver-test',
      sender_id: 'sender-test',
      content: { text: 'hello', status: 'sent' }
    })
    .select();
    
  if (insertErr) {
    console.error('Insert failed:', insertErr);
    return;
  }
  console.log('Insert success!', insertData);

  // 2. Try updating the message status to 'seen' as User B ('receiver-test')
  // Note: we are using the anonymous key, which represents any public user.
  console.log('Attempting to update the message status as receiver...');
  const { data: updateData, error: updateErr } = await supabase
    .from('messages')
    .update({ content: { text: 'hello', status: 'seen' } })
    .eq('id', testMsgId)
    .select();

  if (updateErr) {
    console.error('Update failed:', updateErr);
  } else {
    console.log('Update success! Returned data:', updateData);
  }

  // 3. Clean up
  console.log('Cleaning up test message...');
  const { error: deleteErr } = await supabase
    .from('messages')
    .delete()
    .eq('id', testMsgId);
    
  if (deleteErr) {
    console.error('Delete failed:', deleteErr);
  } else {
    console.log('Delete cleanup success!');
  }
}

check();
