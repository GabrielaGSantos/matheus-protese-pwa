<?php
// API simples de persistência de dados local e integração segura com Google Drive via Service Account.
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Cria o diretório de dados se não existir
$dataDir = __DIR__ . '/../database/json_db';
if (!file_exists($dataDir)) {
    mkdir($dataDir, 0777, true);
}

$action = isset($_GET['action']) ? $_GET['action'] : '';
$key = isset($_GET['key']) ? $_GET['key'] : '';

// Helper to extract Folder ID from Google Drive URL
function getFolderIdFromUrl($url) {
    if (empty($url)) return '';
    if (preg_match('/^[a-zA-Z0-9_-]{25,}$/', $url)) {
        return $url;
    }
    if (preg_match('/\/folders\/([a-zA-Z0-9_-]{25,})/', $url, $matches)) {
        return $matches[1];
    }
    if (preg_match('/id=([a-zA-Z0-9_-]{25,})/', $url, $matches)) {
        return $matches[1];
    }
    return $url;
}

// Google Service Account Authentication and Communication Helper
class GoogleDriveServiceAccount {
    private $credentials;
    private $accessToken;

    public function __construct($credentialsJson) {
        $this->credentials = json_decode($credentialsJson, true);
        if (!$this->credentials || !isset($this->credentials['private_key']) || !isset($this->credentials['client_email'])) {
            throw new Exception('Credenciais da Service Account inválidas. Verifique o JSON colado.');
        }
    }

    private function base64UrlEncode($data) {
        return str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($data));
    }

    public function getAccessToken() {
        if ($this->accessToken) {
            return $this->accessToken;
        }

        $header = json_encode(['alg' => 'RS256', 'typ' => 'JWT']);
        $now = time();
        $payload = json_encode([
            'iss' => $this->credentials['client_email'],
            'scope' => 'https://www.googleapis.com/auth/drive',
            'aud' => $this->credentials['token_uri'] ?? 'https://oauth2.googleapis.com/token',
            'exp' => $now + 3600,
            'iat' => $now
        ]);

        $jwt = $this->base64UrlEncode($header) . '.' . $this->base64UrlEncode($payload);

        $privateKey = $this->credentials['private_key'];
        $signature = '';
        if (!openssl_sign($jwt, $signature, $privateKey, OPENSSL_ALGO_SHA256)) {
            throw new Exception('Falha ao assinar o JWT para autenticação. Verifique se o OpenSSL está ativo e se a chave privada está correta.');
        }

        $assertion = $jwt . '.' . $this->base64UrlEncode($signature);

        $ch = curl_init($this->credentials['token_uri'] ?? 'https://oauth2.googleapis.com/token');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion' => $assertion
        ]));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/x-www-form-urlencoded'
        ]);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

        if (curl_errno($ch)) {
            $error = curl_error($ch);
            curl_close($ch);
            throw new Exception('Erro de rede (cURL) ao autenticar com o Google: ' . $error);
        }
        curl_close($ch);

        if ($httpCode !== 200) {
            throw new Exception('Google Auth retornou HTTP ' . $httpCode . ': ' . $response);
        }

        $data = json_decode($response, true);
        if (!isset($data['access_token'])) {
            throw new Exception('Token de acesso do Google não encontrado na resposta.');
        }

        $this->accessToken = $data['access_token'];
        return $this->accessToken;
    }

    public function request($endpoint, $method = 'GET', $body = null, $headers = []) {
        $token = $this->getAccessToken();
        
        $url = 'https://www.googleapis.com' . $endpoint;
        $ch = curl_init($url);
        
        $defaultHeaders = [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json'
        ];
        
        $mergedHeaders = array_merge($defaultHeaders, $headers);
        
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $mergedHeaders);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        
        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, is_string($body) ? $body : json_encode($body));
        }
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        
        if (curl_errno($ch)) {
            $error = curl_error($ch);
            curl_close($ch);
            throw new Exception('Erro de rede (cURL) na chamada do Google Drive: ' . $error);
        }
        
        curl_close($ch);
        
        return [
            'status' => $httpCode,
            'body' => $response,
            'data' => json_decode($response, true)
        ];
    }

    public function findOrCreateFolder($name, $parentId) {
        $query = "name='" . str_replace("'", "\\'", $name) . "' and mimeType='application/vnd.google-apps.folder' and '" . $parentId . "' in parents and trashed=false";
        $endpoint = '/drive/v3/files?q=' . urlencode($query) . '&fields=files(id,name,webViewLink)&spaces=drive';
        
        $res = $this->request($endpoint, 'GET');
        
        if ($res['status'] !== 200) {
            throw new Exception('Erro ao buscar pasta "' . $name . '": HTTP ' . $res['status'] . ' - ' . $res['body']);
        }
        
        if (!empty($res['data']['files'])) {
            return $res['data']['files'][0];
        }
        
        $body = [
            'name' => $name,
            'mimeType' => 'application/vnd.google-apps.folder',
            'parents' => [$parentId]
        ];
        
        $createRes = $this->request('/drive/v3/files?fields=id,name,webViewLink', 'POST', $body);
        
        if ($createRes['status'] !== 200) {
            throw new Exception('Erro ao criar pasta "' . $name . '": HTTP ' . $createRes['status'] . ' - ' . $createRes['body']);
        }
        
        return $createRes['data'];
    }

    public function uploadFile($filePath, $fileName, $mimeType, $folderId) {
        $metadata = [
            'name' => $fileName,
            'parents' => [$folderId]
        ];
        
        $boundary = 'foo_bar_baz_boundary';
        $delimiter = "\r\n--" . $boundary . "\r\n";
        $closeDelimiter = "\r\n--" . $boundary . "--";
        
        $fileData = file_get_contents($filePath);
        
        $body = $delimiter
              . "Content-Type: application/json; charset=UTF-8\r\n\r\n"
              . json_encode($metadata)
              . $delimiter
              . "Content-Type: " . ($mimeType ?: 'application/octet-stream') . "\r\n\r\n"
              . $fileData
              . $closeDelimiter;
              
        $headers = [
            'Content-Type: multipart/related; boundary=' . $boundary,
            'Content-Length: ' . strlen($body)
        ];
        
        $res = $this->request('/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink', 'POST', $body, $headers);
        
        if ($res['status'] !== 200) {
            throw new Exception('Erro ao enviar arquivo "' . $fileName . '": HTTP ' . $res['status'] . ' - ' . $res['body']);
        }
        
        return $res['data'];
    }
}

// ENDPOINTS DA SERVICE ACCOUNT DO GOOGLE DRIVE
if ($action === 'create_folders') {
    $caseId = $_GET['case_id'] ?? $_POST['case_id'] ?? '';
    $patientName = $_GET['patient_name'] ?? $_POST['patient_name'] ?? '';
    $dentistName = $_GET['dentist_name'] ?? $_POST['dentist_name'] ?? '';
    
    if (empty($caseId) || empty($patientName) || empty($dentistName)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Parâmetros ausentes (case_id, patient_name, dentist_name)']);
        exit;
    }
    
    $settingsFile = $dataDir . '/gdrive_shared_settings.json';
    if (!file_exists($settingsFile)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Configurações do Google Drive não encontradas.']);
        exit;
    }
    
    $settings = json_decode(file_get_contents($settingsFile), true);
    $serviceAccountJson = $settings['service_account_json'] ?? '';
    $rootFolderUrl = $settings['root_folder_url'] ?? '';
    $rootFolderId = getFolderIdFromUrl($rootFolderUrl);
    
    if (empty($serviceAccountJson) || empty($rootFolderId)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Google Drive não configurado ou falta pasta raiz no painel.']);
        exit;
    }
    
    try {
        $driver = new GoogleDriveServiceAccount($serviceAccountJson);
        
        $casesFile = $dataDir . '/matheus_protese_cases.json';
        $cases = [];
        if (file_exists($casesFile)) {
            $cases = json_decode(file_get_contents($casesFile), true) ?: [];
        }
        
        $caseIndex = -1;
        $caseObj = null;
        foreach ($cases as $idx => $c) {
            if ($c['id'] === $caseId) {
                $caseIndex = $idx;
                $caseObj = $c;
                break;
            }
        }
        
        // Cria a estrutura de pastas
        $dentistFolder = $driver->findOrCreateFolder($dentistName, $rootFolderId);
        $caseFolderName = $patientName . ' - ' . $caseId;
        $caseFolder = $driver->findOrCreateFolder($caseFolderName, $dentistFolder['id']);
        $caseFolderUrl = $caseFolder['webViewLink'] ?? ('https://drive.google.com/drive/folders/' . $caseFolder['id']);
        
        $imagesFolder = $driver->findOrCreateFolder('Imagens', $caseFolder['id']);
        $scanFolder = $driver->findOrCreateFolder('Escaneamento', $caseFolder['id']);
        $resultFolder = $driver->findOrCreateFolder('Enceramento Digital', $caseFolder['id']);
        
        $updatedCaseObj = null;
        if ($caseIndex >= 0) {
            $cases[$caseIndex]['drive_status'] = 'created';
            $cases[$caseIndex]['drive_dentist_folder_id'] = $dentistFolder['id'];
            $cases[$caseIndex]['drive_case_folder_id'] = $caseFolder['id'];
            $cases[$caseIndex]['drive_images_folder_id'] = $imagesFolder['id'];
            $cases[$caseIndex]['drive_scan_folder_id'] = $scanFolder['id'];
            $cases[$caseIndex]['drive_result_folder_id'] = $resultFolder['id'];
            $cases[$caseIndex]['drive_case_folder_url'] = $caseFolderUrl;
            $cases[$caseIndex]['google_drive_folder_url'] = $caseFolderUrl;
            $cases[$caseIndex]['google_drive_folder_id'] = $caseFolder['id'];
            $cases[$caseIndex]['updated_at'] = gmdate('Y-m-d\TH:i:s') . '.000Z';
            
            file_put_contents($casesFile, json_encode($cases, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            $updatedCaseObj = $cases[$caseIndex];
        }
        
        echo json_encode([
            'success' => true,
            'dentistFolderId' => $dentistFolder['id'],
            'caseFolderId' => $caseFolder['id'],
            'imagesFolderId' => $imagesFolder['id'],
            'scanFolderId' => $scanFolder['id'],
            'resultFolderId' => $resultFolder['id'],
            'caseFolderUrl' => $caseFolderUrl,
            'case' => $updatedCaseObj
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

if ($action === 'test_drive') {
    $inputData = json_decode(file_get_contents('php://input'), true);
    
    $serviceAccountJson = '';
    $rootFolderUrl = '';
    
    if (isset($inputData['service_account_json'])) {
        $serviceAccountJson = $inputData['service_account_json'];
        $rootFolderUrl = $inputData['root_folder_url'] ?? '';
    } else {
        $settingsFile = $dataDir . '/gdrive_shared_settings.json';
        if (file_exists($settingsFile)) {
            $settings = json_decode(file_get_contents($settingsFile), true);
            $serviceAccountJson = $settings['service_account_json'] ?? '';
            $rootFolderUrl = $settings['root_folder_url'] ?? '';
        }
    }
    
    if (empty($serviceAccountJson)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Configurações de Conta de Serviço vazias ou não fornecidas.']);
        exit;
    }
    
    try {
        $driver = new GoogleDriveServiceAccount($serviceAccountJson);
        $token = $driver->getAccessToken();
        
        $rootFolderId = getFolderIdFromUrl($rootFolderUrl);
        if (empty($rootFolderId)) {
            echo json_encode([
                'success' => true,
                'message' => 'Autenticação realizada com sucesso! (Nenhuma pasta raiz configurada)'
            ]);
            exit;
        }
        
        $res = $driver->request('/drive/v3/files/' . $rootFolderId . '?fields=id,name', 'GET');
        if ($res['status'] !== 200) {
            $credArr = json_decode($serviceAccountJson, true);
            $email = isset($credArr['client_email']) ? $credArr['client_email'] : 'e-mail da service account';
            echo json_encode([
                'success' => false,
                'error' => 'Autenticado com sucesso, mas sem acesso à pasta raiz (HTTP ' . $res['status'] . '). Certifique-se de que a pasta no seu Drive está compartilhada com o e-mail: ' . $email
            ]);
            exit;
        }
        
        echo json_encode([
            'success' => true,
            'message' => '✅ Conexão OK! Pasta raiz detectada: "' . $res['data']['name'] . '"'
        ]);
        
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

if ($action === 'upload_file') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Método não suportado. Use POST']);
        exit;
    }
    
    if (!isset($_FILES['file'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Nenhum arquivo enviado']);
        exit;
    }
    
    $caseId = $_POST['case_id'] ?? '';
    $patientName = $_POST['patient_name'] ?? '';
    $dentistName = $_POST['dentist_name'] ?? '';
    $category = $_POST['category'] ?? '';
    $uploadedBy = $_POST['uploaded_by'] ?? 'admin-1';
    
    if (empty($caseId) || empty($patientName) || empty($dentistName) || empty($category)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Parâmetros ausentes (case_id, patient_name, dentist_name, category)']);
        exit;
    }
    
    $settingsFile = $dataDir . '/gdrive_shared_settings.json';
    if (!file_exists($settingsFile)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Configurações do Google Drive não encontradas no servidor.']);
        exit;
    }
    
    $settings = json_decode(file_get_contents($settingsFile), true);
    $serviceAccountJson = $settings['service_account_json'] ?? '';
    $rootFolderUrl = $settings['root_folder_url'] ?? '';
    $rootFolderId = getFolderIdFromUrl($rootFolderUrl);
    
    if (empty($serviceAccountJson) || empty($rootFolderId)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Google Drive não está configurado ou falta a pasta raiz no painel do administrador.']);
        exit;
    }
    
    try {
        $driver = new GoogleDriveServiceAccount($serviceAccountJson);
        
        $casesFile = $dataDir . '/matheus_protese_cases.json';
        $cases = [];
        if (file_exists($casesFile)) {
            $cases = json_decode(file_get_contents($casesFile), true) ?: [];
        }
        
        $caseIndex = -1;
        $caseObj = null;
        foreach ($cases as $idx => $c) {
            if ($c['id'] === $caseId) {
                $caseIndex = $idx;
                $caseObj = $c;
                break;
            }
        }
        
        $driveStatus = isset($caseObj['drive_status']) ? $caseObj['drive_status'] : 'not_created';
        $driveDentistFolderId = isset($caseObj['drive_dentist_folder_id']) ? $caseObj['drive_dentist_folder_id'] : null;
        $driveCaseFolderId = isset($caseObj['drive_case_folder_id']) ? $caseObj['drive_case_folder_id'] : null;
        $driveImagesFolderId = isset($caseObj['drive_images_folder_id']) ? $caseObj['drive_images_folder_id'] : null;
        $driveScanFolderId = isset($caseObj['drive_scan_folder_id']) ? $caseObj['drive_scan_folder_id'] : null;
        $driveResultFolderId = isset($caseObj['drive_result_folder_id']) ? $caseObj['drive_result_folder_id'] : null;
        $driveCaseFolderUrl = isset($caseObj['drive_case_folder_url']) ? $caseObj['drive_case_folder_url'] : null;
        
        if ($driveStatus !== 'created' || empty($driveCaseFolderId)) {
            $dentistFolder = $driver->findOrCreateFolder($dentistName, $rootFolderId);
            $driveDentistFolderId = $dentistFolder['id'];
            
            $caseFolderName = $patientName . ' - ' . $caseId;
            $caseFolder = $driver->findOrCreateFolder($caseFolderName, $driveDentistFolderId);
            $driveCaseFolderId = $caseFolder['id'];
            $driveCaseFolderUrl = $caseFolder['webViewLink'] ?? ('https://drive.google.com/drive/folders/' . $driveCaseFolderId);
            
            $imagesFolder = $driver->findOrCreateFolder('Imagens', $driveCaseFolderId);
            $driveImagesFolderId = $imagesFolder['id'];
            
            $scanFolder = $driver->findOrCreateFolder('Escaneamento', $driveCaseFolderId);
            $driveScanFolderId = $scanFolder['id'];
            
            $resultFolder = $driver->findOrCreateFolder('Enceramento Digital', $driveCaseFolderId);
            $driveResultFolderId = $resultFolder['id'];
            
            $driveStatus = 'created';
            
            if ($caseIndex >= 0) {
                $cases[$caseIndex]['drive_status'] = 'created';
                $cases[$caseIndex]['drive_dentist_folder_id'] = $driveDentistFolderId;
                $cases[$caseIndex]['drive_case_folder_id'] = $driveCaseFolderId;
                $cases[$caseIndex]['drive_images_folder_id'] = $driveImagesFolderId;
                $cases[$caseIndex]['drive_scan_folder_id'] = $driveScanFolderId;
                $cases[$caseIndex]['drive_result_folder_id'] = $driveResultFolderId;
                $cases[$caseIndex]['drive_case_folder_url'] = $driveCaseFolderUrl;
                $cases[$caseIndex]['google_drive_folder_url'] = $driveCaseFolderUrl;
                $cases[$caseIndex]['google_drive_folder_id'] = $driveCaseFolderId;
                $cases[$caseIndex]['updated_at'] = gmdate('Y-m-d\TH:i:s') . '.000Z';
                
                file_put_contents($casesFile, json_encode($cases, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            }
        }
        
        $targetFolderId = null;
        if ($category === 'imagens') {
            $targetFolderId = $driveImagesFolderId;
        } else if ($category === 'escaneamento') {
            $targetFolderId = $driveScanFolderId;
        } else if ($category === 'resultado') {
            if (empty($driveResultFolderId)) {
                $resultFolder = $driver->findOrCreateFolder('Enceramento Digital', $driveCaseFolderId);
                $driveResultFolderId = $resultFolder['id'];
                
                if ($caseIndex >= 0) {
                    $cases[$caseIndex]['drive_result_folder_id'] = $driveResultFolderId;
                    file_put_contents($casesFile, json_encode($cases, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
                }
            }
            $targetFolderId = $driveResultFolderId;
        }
        
        if (empty($targetFolderId)) {
            throw new Exception('Pasta de destino do Google Drive inválida para a categoria: ' . $category);
        }
        
        $uploadedFile = $_FILES['file'];
        $driveFile = $driver->uploadFile(
            $uploadedFile['tmp_name'],
            $uploadedFile['name'],
            $uploadedFile['type'],
            $targetFolderId
        );
        
        $attachmentsFile = $dataDir . '/matheus_protese_attachments.json';
        $attachments = [];
        if (file_exists($attachmentsFile)) {
            $attachments = json_decode(file_get_contents($attachmentsFile), true) ?: [];
        }
        
        $attachmentId = 'att-' . time() . '-' . substr(md5(uniqid()), 0, 9);
        $newAttachment = [
            'id' => $attachmentId,
            'case_id' => $caseId,
            'google_drive_file_id' => $driveFile['id'],
            'file_name' => $driveFile['name'],
            'file_size' => $uploadedFile['size'],
            'mime_type' => $driveFile['mimeType'] ?: $uploadedFile['type'],
            'uploaded_by' => $uploadedBy,
            'created_at' => gmdate('Y-m-d\TH:i:s') . '.000Z',
            'folder_id' => $targetFolderId,
            'web_view_link' => $driveFile['webViewLink'] ?? null,
            'file_category' => $category
        ];
        
        $attachments[] = $newAttachment;
        file_put_contents($attachmentsFile, json_encode($attachments, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        
        // Se atualizamos o caso com novos IDs de pasta, recarregamos o caso para devolver as pastas atualizadas
        $updatedCaseObj = null;
        if ($caseIndex >= 0) {
            $updatedCases = json_decode(file_get_contents($casesFile), true) ?: [];
            foreach ($updatedCases as $uc) {
                if ($uc['id'] === $caseId) {
                    $updatedCaseObj = $uc;
                    break;
                }
            }
        }
        
        echo json_encode([
            'success' => true,
            'attachment' => $newAttachment,
            'case' => $updatedCaseObj
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

// PERSISTÊNCIA GENÉRICA DOS DADOS
// Validar chave para evitar Directory Traversal
if (empty($key) || !preg_match('/^[a-zA-Z0-9_-]+$/', $key)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Chave inválida ou vazia']);
    exit;
}

$filePath = $dataDir . '/' . $key . '.json';

if ($_SERVER['REQUEST_METHOD'] === 'GET' || $action === 'get') {
    if (file_exists($filePath)) {
        $data = file_get_contents($filePath);
        echo json_encode([
            'success' => true,
            'key' => $key,
            'data' => json_decode($data, true)
        ]);
    } else {
        echo json_encode([
            'success' => true,
            'key' => $key,
            'data' => null
        ]);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' || $action === 'set') {
    $postData = file_get_contents('php://input');
    
    // Validar se é um JSON válido
    $jsonData = json_decode($postData, true);
    if ($jsonData === null && json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'JSON inválido']);
        exit;
    }
    
    // Gravar no arquivo
    $bytes = file_put_contents($filePath, json_encode($jsonData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    
    if ($bytes === false) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Falha ao gravar arquivo no servidor']);
    } else {
        echo json_encode(['success' => true, 'key' => $key, 'bytes_written' => $bytes]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Método não suportado']);
