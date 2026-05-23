import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uyfcvquwmmvphiezvwvz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5ZmN2cXV3bW12cGhpZXp2d3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMTE2NTYsImV4cCI6MjA5MjY4NzY1Nn0.TP-ekZJOe4L54kPNU4BespFTpmJZN5mzBBTMBuEJFK4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const testMsgId = 'test_rpc_' + Date.now();
  console.log('Inserting test message:', testMsgId);

  const { data: insertData, error: insertErr } = await supabase
    .from('messages')
    .insert({
      id: testMsgId,
      chat_id: 'test_recipient',
      sender_id: 'test_sender',
      content: { id: testMsgId, text: 'hello', status: 'sent', seenBy: ['test_sender'] }
    })
    .select();

  if (insertErr) {
    console.error('Insert failed:', insertErr);
    return;
  }
  console.log('Insert success!', insertData);

  console.log('Calling append_message_status for delivered...');
  const { data: rpcData1, error: rpcErr1 } = await supabase.rpc('append_message_status', {
    msg_id: testMsgId,
    user_id: 'test_recipient',
    status_type: 'delivered'
  });

  if (rpcErr1) {
    console.error('RPC delivered failed:', rpcErr1);
  } else {
    console.log('RPC delivered success! Result:', rpcData1);
  }

  const { data: selectData1 } = await supabase.from('messages').select('*').eq('id', testMsgId);
  console.log('After delivered call, row is:', JSON.stringify(selectData1, null, 2));

  console.log('Calling append_message_status for seen...');
  const { data: rpcData2, error: rpcErr2 } = await supabase.rpc('append_message_status', {
    msg_id: testMsgId,
    user_id: 'test_recipient',
    status_type: 'seen'
  });

  if (rpcErr2) {
    console.error('RPC seen failed:', rpcErr2);
  } else {
    console.log('RPC seen success! Result:', rpcData2);
  }

  const { data: selectData2 } = await supabase.from('messages').select('*').eq('id', testMsgId);
  console.log('After seen call, row is:', JSON.stringify(selectData2, null, 2));

  console.log('Cleaning up test message...');
  await supabase.from('messages').delete().eq('id', testMsgId);
  console.log('Cleanup done.');
}

test();
