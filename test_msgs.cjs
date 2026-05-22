const { createClient } = require('@supabase/supabase-js');
const CryptoJS = require('crypto-js');
const supabaseUrl = 'https://uyfcvquwmmvphiezvwvz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5ZmN2cXV3bW12cGhpZXp2d3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMTE2NTYsImV4cCI6MjA5MjY4NzY1Nn0.TP-ekZJOe4L54kPNU4BespFTpmJZN5mzBBTMBuEJFK4';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const decrypt = (cipherText, secretKey) => {
  if (!cipherText || typeof cipherText !== 'string') return cipherText;
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, secretKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (err) {
    return null;
  }
};

async function run() {
  const { data } = await supabase.from('messages').select('*').limit(10).order('created_at', { ascending: false });
  console.log(data.map(m => {
    let content = m.content;
    if (typeof content === 'string') content = JSON.parse(content);
    const text1 = decrypt(content.text, m.chat_id);
    const text2 = decrypt(content.text, m.sender_id);
    return {
      id: m.id,
      chat_id: m.chat_id,
      sender: m.sender_id,
      status: content.status,
      text_with_chat_id: text1,
      text_with_sender_id: text2,
    };
  }));
}
run();
