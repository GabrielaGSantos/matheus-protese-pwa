import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.pathname.split('/').pop() || url.searchParams.get('action');

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const redirectUri = Deno.env.get('GOOGLE_REDIRECT_URI');
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:5173';

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('As variáveis de ambiente do Google (Supabase Secrets) não estão configuradas.');
    }

    // Ação: Redirecionar para o Google
    if (action === 'auth' || action === 'gdrive-auth') {
      const scope = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly";
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;
      
      // Retorna a URL para o frontend redirecionar
      return new Response(JSON.stringify({ url: authUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Ação: Receber o callback do Google
    if (action === 'callback') {
      const code = url.searchParams.get('code');
      if (!code) {
        throw new Error('Código de autorização não recebido.');
      }

      // Trocar code por tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const tokenData = await tokenResponse.json();
      
      if (tokenData.error) {
        throw new Error(`Erro do Google: ${tokenData.error_description || tokenData.error}`);
      }

      if (!tokenData.refresh_token) {
        // Se não veio refresh token, significa que o consentimento já foi dado antes
        // Precisaríamos revogar o acesso ou instruir o usuário a fazê-lo para forçar novo refresh token
        throw new Error('Nenhum refresh_token retornado. O usuário deve revogar o acesso no Google e tentar novamente para forçar um novo consentimento offline.');
      }

      // Salvar token no banco
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Usaremos a tabela gdrive_config
      const { error: dbError } = await supabase
        .from('gdrive_config')
        .upsert({ id: 1, refresh_token: tokenData.refresh_token });

      if (dbError) throw dbError;

      // Redirecionar de volta para o frontend
      return Response.redirect(`${frontendUrl}/settings?gdrive=connected`, 302);
    }

    throw new Error('Ação inválida.');
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
