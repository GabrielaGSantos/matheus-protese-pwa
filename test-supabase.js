const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qdzohqbxyfurpurprpzw.supabase.co';
const supabaseKey = 'sb_publishable_qface6MZ206srnzHN1-k-A_gvXuTHB1'; // We need the service role or admin jwt?

// We can just login as Admin!
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@matheus.com', // wait, do we know the admin email?
    password: 'cad_123456'
  });
  console.log('Login:', authData?.user?.email, authErr);
}

test();
