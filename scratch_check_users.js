import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://uyfcvquwmmvphiezvwvz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5ZmN2cXV3bW12cGhpZXp2d3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMTE2NTYsImV4cCI6MjA5MjY4NzY1Nn0.TP-ekZJOe4L54kPNU4BespFTpmJZN5mzBBTMBuEJFK4';

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkUsers() {
  const { data, error } = await supabase.from('users').select('*').limit(1)
  if (error) {
    console.error('Error:', error)
  } else {
    console.log('User columns:', Object.keys(data[0] || {}))
    console.log('User data sample:', JSON.stringify(data[0] || {}, null, 2))
  }
}

checkUsers()
