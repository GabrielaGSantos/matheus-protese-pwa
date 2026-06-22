import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Google Drive API Helpers ---

async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string) {
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const tokenData = await tokenResponse.json();
  if (tokenData.error) {
    throw new Error(`Erro ao atualizar token do Google: ${tokenData.error_description || tokenData.error}`);
  }
  return tokenData.access_token;
}

async function findOrCreateFolder(accessToken: string, folderName: string, parentId?: string) {
  const q = `name='${folderName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentId ? ` and '${parentId}' in parents` : ''}`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`;
  
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const searchData = await searchRes.json();
  
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    }),
  });

  const createData = await createRes.json();
  if (createData.error) throw new Error(`Erro ao criar pasta no Drive: ${createData.error.message}`);
  return createData.id;
}

async function uploadFileToDrive(accessToken: string, file: File, parentId: string) {
  const metadata = {
    name: file.name,
    parents: [parentId]
  };

  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('file', file);

  const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,mimeType,size', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  const uploadData = await uploadRes.json();
  if (uploadData.error) throw new Error(`Erro no upload: ${uploadData.error.message}`);
  return uploadData;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const action = formData.get('action') as string;
    const caseId = formData.get('case_id') as string;
    const dentistId = formData.get('dentist_id') as string;
    const dentistName = formData.get('dentist_name') as string;
    const patientName = formData.get('patient_name') as string;
    const uploadedBy = formData.get('uploaded_by') as string;

    const file = formData.get('file') as File | null;

    if (action !== 'test_connection' && (!caseId || !dentistId || !dentistName || !patientName)) {
      throw new Error('Parâmetros incompletos para a operação.');
    }

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error('Chaves do Google não configuradas nas Secrets.');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Pegar o token
    const { data: configData, error: configError } = await supabase
      .from('gdrive_config')
      .select('refresh_token, root_folder_id')
      .eq('id', 1)
      .single();

    if (configError || !configData?.refresh_token) {
      throw new Error('Integração com Google Drive não configurada ou token ausente.');
    }

    const accessToken = await getAccessToken(clientId, clientSecret, configData.refresh_token);
    const rootFolderId = configData.root_folder_id; // Se nulo, criará no root do drive

    if (action === 'test_connection') {
      return new Response(JSON.stringify({ success: true, message: 'Conexão testada com sucesso (token válido)' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar informações do caso para formatação da pasta
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('case_number, drive_case_folder_id, drive_dentist_folder_id')
      .eq('id', caseId)
      .single();

    if (caseError || !caseData) {
      throw new Error('Erro ao buscar dados do caso no banco.');
    }

    // Garantir pasta do dentista
    let dentistFolderId = caseData.drive_dentist_folder_id;
    if (!dentistFolderId) {
      dentistFolderId = await findOrCreateFolder(accessToken, dentistName, rootFolderId);
    }

    // Garantir pasta do caso
    let caseFolderId = caseData.drive_case_folder_id;
    
    if (!caseFolderId) {
      const sanitizedPatientName = patientName.replace(/[<>:"/\\|?*]/g, '').trim();
      const caseNumber = caseData.case_number || 'S/N';
      const caseFolderName = `Paciente: ${sanitizedPatientName} - ${caseNumber} - ${caseId}`;
      caseFolderId = await findOrCreateFolder(accessToken, caseFolderName, dentistFolderId);

      // Atualizar tabela cases com a URL correta do Drive e IDs
      await supabase
        .from('cases')
        .update({
          google_drive_folder_url: `https://drive.google.com/drive/folders/${caseFolderId}`,
          drive_case_folder_id: caseFolderId,
          drive_dentist_folder_id: dentistFolderId,
          drive_status: 'created'
        })
        .eq('id', caseId);
    }

    if (action === 'create_folders') {
      // Pré-criar as subpastas
      await findOrCreateFolder(accessToken, 'Fotos Clínicas', caseFolderId);
      await findOrCreateFolder(accessToken, 'Escaneamento', caseFolderId);
      await findOrCreateFolder(accessToken, 'Enceramento Digital', caseFolderId);

      return new Response(JSON.stringify({ success: true, caseFolderId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!file) {
      throw new Error('Nenhum arquivo enviado para upload.');
    }

    const category = formData.get('category') as string;
    let targetFolderId = caseFolderId;
    
    if (category) {
      let subfolderName = '';
      if (category === 'imagens') subfolderName = 'Fotos Clínicas';
      else if (category === 'escaneamento') subfolderName = 'Escaneamento';
      else if (category === 'enceramento_digital' || category === 'resultado') subfolderName = 'Enceramento Digital';
      
      if (subfolderName) {
        targetFolderId = await findOrCreateFolder(accessToken, subfolderName, caseFolderId);
      }
    }

    // Fazer upload do arquivo
    const driveFile = await uploadFileToDrive(accessToken, file, targetFolderId);

    // Salvar metadados no Supabase
    const { data: attachment, error: insertError } = await supabase
      .from('case_attachments')
      .insert({
        case_id: caseId,
        dentist_id: uploadedBy || null,
        drive_file_id: driveFile.id,
        drive_folder_id: targetFolderId,
        file_name: driveFile.name,
        mime_type: driveFile.mimeType || file.type,
        file_size: parseInt(driveFile.size || '0', 10),
        web_view_link: `${driveFile.webViewLink}#cat=${category || ''}`,
        uploaded_by: uploadedBy || 'System'
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Erro ao salvar metadados no banco: ${insertError.message}`);
    }

    return new Response(JSON.stringify({ success: true, attachment }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
