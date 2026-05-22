const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://uyfcvquwmmvphiezvwvz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5ZmN2cXV3bW12cGhpZXp2d3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMTE2NTYsImV4cCI6MjA5MjY4NzY1Nn0.TP-ekZJOe4L54kPNU4BespFTpmJZN5mzBBTMBuEJFK4';
const supabase = createClient(supabaseUrl, supabaseAnonKey);
async function run() {
  const { data } = await supabase.from('chats').select('owner_id, chat_data').eq('owner_id', 'shevanshe');
  const groups = data.filter(d => d.chat_data?.type === 'group');
  console.log(JSON.stringify(groups.map(g => ({
    owner: g.owner_id,
    chat_id: g.chat_data.id,
    members: (g.chat_data.members || []).map(m => ({ id: m.id, role: m.role })),
    status: g.chat_data.status
  })), null, 2));
}
run();
