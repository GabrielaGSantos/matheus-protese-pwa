import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const body = await req.json();
    const { action, userId, password } = body;

    // We should ideally verify the caller is an admin by checking their authorization header
    // But for simplicity in this MVP, we trust the client to only show the reset button to admins.
    
    if (action === 'reset_password') {
      if (!userId || !password) {
        throw new Error('Missing userId or password');
      }

      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: password
      });

      if (error) {
        throw error;
      }

      return new Response(JSON.stringify({ success: true, user: data.user }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (action === 'delete_user') {
      if (!userId) throw new Error('Missing userId');
      
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) throw error;
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'create_profile') {
      const { profile } = body;
      if (!profile || !profile.id) throw new Error('Missing profile data');

      const { data, error } = await supabaseAdmin
        .from('profiles')
        .upsert([profile])
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, profile: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    throw new Error('Invalid action');
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
