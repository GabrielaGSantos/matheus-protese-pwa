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
    const payload = await req.json();
    
    const {
      action,
      caseId,
      caseNumber,
      patientName,
      dentistName,
      services,
      dueDate,
      changesText,
      uploadDetails
    } = payload;

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const chatIdsStr = Deno.env.get('TELEGRAM_CHAT_ID');

    if (!botToken || !chatIdsStr) {
      const errorMsg = 'Configurações do Telegram ausentes nas variáveis de ambiente (TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID).';
      await supabase.from('telegram_logs').insert({
        event_type: action,
        case_id: caseId,
        success: false,
        response: errorMsg,
        chat_id: 'internal'
      });
      throw new Error(errorMsg);
    }

    let text = '';

    if (action === 'new_case') {
      text = `[Novo caso criado]\nPaciente: ${patientName}\nCaso: ${caseNumber}\nID interno: ${caseId}\nDentista: ${dentistName}\nEntrega solicitada: ${dueDate || 'Não definida'}\nServiços: ${services || 'Nenhum'}`;
    } else if (action === 'edit_case' || action === 'status_change') {
      text = `[Caso editado]\n\nPaciente: ${patientName}\nCaso: ${caseNumber}\nID interno: ${caseId}\n\nAlterações:\n${changesText}`;
    } else if (action === 'upload_file') {
      text = `[Novo arquivo enviado]\n\nCaso: ${caseNumber}\nPaciente: ${patientName}\nID interno: ${caseId}\n\nOrigem: ${uploadDetails?.sender}\nCategoria: ${uploadDetails?.category}\n\nArquivos:\n${uploadDetails?.fileNames?.map((f: string) => `- ${f}`).join('\n')}`;
    } else if (action === 'upload_result') {
      text = `[Resultado enviado]\n\nCaso: ${caseNumber}\nPaciente: ${patientName}\nID interno: ${caseId}\nDentista: ${dentistName}\n\nArquivos:\n${uploadDetails?.fileNames?.map((f: string) => `- ${f}`).join('\n')}`;
    } else if (action === 'due_date') {
      text = `[Caso próximo do vencimento]\n\nPaciente: ${patientName}\nCaso: ${caseNumber}\nID interno: ${caseId}\nDentista: ${dentistName}\nEntrega: ${dueDate}\nServiços: ${services || 'Nenhum'}`;
    } else {
      text = `[Notificação]\nCaso: ${caseNumber}\nID: ${caseId}`;
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const chatIds = chatIdsStr.split(',').map((id: string) => id.trim()).filter((id: string) => id.length > 0);

    let allSuccess = true;
    let anySuccess = false;
    let lastError = '';

    for (const chatId of chatIds) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text
        })
      });

      const resData = await res.text();

      // Log the attempt
      await supabase.from('telegram_logs').insert({
        event_type: action,
        case_id: caseId,
        success: res.ok,
        response: resData,
        chat_id: chatId
      });

      if (res.ok) {
        anySuccess = true;
      } else {
        allSuccess = false;
        lastError = resData;
      }
    }

    return new Response(JSON.stringify({ success: anySuccess, error: allSuccess ? undefined : lastError }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
