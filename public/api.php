<?php
// Configurar tratamento rígido de erros e forçar JSON
ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('error_log', __DIR__ . '/../database/json_db/backend_errors.log');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-User-Id');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Iniciar sessão
session_start();

$dataDir = __DIR__ . '/../database/json_db';
if (!file_exists($dataDir)) {
    mkdir($dataDir, 0777, true);
}

$action = isset($_GET['action']) ? $_GET['action'] : '';
$key = isset($_GET['key']) ? $_GET['key'] : '';

// Helper to log errors
function logBackendError($message, $context = []) {
    $logFile = __DIR__ . '/../database/json_db/backend_errors.log';
    $timestamp = date('Y-m-d H:i:s');
    $contextStr = !empty($context) ? ' | Context: ' . json_encode($context, JSON_UNESCAPED_UNICODE) : '';
    @file_put_contents($logFile, "[$timestamp] ERROR: $message$contextStr\n", FILE_APPEND);
}

// Helper to log audits
function logBackendAudit($message, $context = []) {
    $logFile = __DIR__ . '/../database/json_db/backend_audit.log';
    $timestamp = date('Y-m-d H:i:s');
    $contextStr = !empty($context) ? ' | ' . json_encode($context, JSON_UNESCAPED_UNICODE) : '';
    @file_put_contents($logFile, "[$timestamp] AUDIT: $message$contextStr\n", FILE_APPEND);
}

// Helper to get private credentials
function getGoogleCredentials() {
    $privateFile = __DIR__ . '/../database/gdrive_private_credentials.json';
    if (file_exists($privateFile)) {
        $data = file_get_contents($privateFile);
        return json_decode($data, true);
    }
    return null;
}

// Helper to resolve authenticated user from session or header
function getAuthenticatedUser($dataDir) {
    // 1. Check PHP Session first
    if (isset($_SESSION['user']) && isset($_SESSION['user']['id'])) {
        return $_SESSION['user'];
    }
    
    // 2. Check HTTP headers (case-insensitive)
    $userId = '';
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        if ($headers) {
            foreach ($headers as $name => $value) {
                if (strcasecmp($name, 'X-User-Id') === 0) {
                    $userId = $value;
                    break;
                }
            }
        }
    }
    if (empty($userId) && isset($_SERVER['HTTP_X_USER_ID'])) {
        $userId = $_SERVER['HTTP_X_USER_ID'];
    }
    if (empty($userId)) {
        $userId = $_GET['user_id'] ?? $_POST['user_id'] ?? '';
    }
    
    if (!empty($userId)) {
        $profilesFile = $dataDir . '/matheus_protese_profiles.json';
        if (file_exists($profilesFile)) {
            $profiles = json_decode(file_get_contents($profilesFile), true) ?: [];
            foreach ($profiles as $p) {
                if ($p['id'] === $userId) {
                    return $p;
                }
            }
        }
    }
    
    return null;
}

// Helper to get public settings
function getGDrivePublicSettings($dataDir) {
    $settingsFile = $dataDir . '/gdrive_shared_settings.json';
    $settings = [];
    if (file_exists($settingsFile)) {
        $settings = json_decode(file_get_contents($settingsFile), true) ?: [];
    }
    
    // Ensure credentials keys are completely removed
    unset($settings['service_account_json']);
    unset($settings['private_key']);
    unset($settings['client_secret']);
    unset($settings['refresh_token']);
    
    $creds = getGoogleCredentials();
    if ($creds) {
        $settings['client_email'] = $creds['client_email'] ?? '';
        $settings['project_id'] = $creds['project_id'] ?? '';
        $settings['is_oauth_user'] = isset($creds['refresh_token']);
        $settings['oauth_client_id'] = $creds['client_id'] ?? '';
        $settings['drive_connected'] = true;
    } else {
        $settings['client_email'] = '';
        $settings['project_id'] = '';
        $settings['is_oauth_user'] = false;
        $settings['oauth_client_id'] = '';
        $settings['drive_connected'] = false;
    }
    return $settings;
}

// Helper to extract Folder ID from URL
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

// Google Drive Service Account or User OAuth2 Handler
class GoogleDriveServiceAccount {
    private $credentials;
    private $accessToken;

    public function __construct($credentialsJson) {
        $this->credentials = json_decode($credentialsJson, true);
        if (!$this->credentials) {
            throw new Exception('JSON de credenciais do Google Drive inválido.');
        }

        $isServiceAccount = isset($this->credentials['private_key']) && isset($this->credentials['client_email']);
        $isUserOAuth = isset($this->credentials['client_id']) && isset($this->credentials['client_secret']) && isset($this->credentials['refresh_token']);

        if (!$isServiceAccount && !$isUserOAuth) {
            throw new Exception('Credenciais do Google Drive inválidas. O JSON deve conter as chaves de Conta de Serviço (private_key, client_email) OU chaves de aplicativo OAuth2 do Usuário (client_id, client_secret, refresh_token).');
        }
    }

    private function base64UrlEncode($data) {
        return str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($data));
    }

    public function getAccessToken() {
        if ($this->accessToken) {
            return $this->accessToken;
        }

        // Se for OAuth 2.0 do Usuário (Refresh Token)
        if (isset($this->credentials['refresh_token'])) {
            $ch = curl_init($this->credentials['token_uri'] ?? 'https://oauth2.googleapis.com/token');
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
                'client_id' => $this->credentials['client_id'],
                'client_secret' => $this->credentials['client_secret'],
                'refresh_token' => $this->credentials['refresh_token'],
                'grant_type' => 'refresh_token'
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
                throw new Exception('Erro de rede (cURL) ao autenticar via OAuth de Usuário com o Google: ' . $error);
            }
            curl_close($ch);

            if ($httpCode !== 200) {
                throw new Exception('Google Auth (OAuth User) retornou HTTP ' . $httpCode . ': ' . $response);
            }

            $data = json_decode($response, true);
            if (!isset($data['access_token'])) {
                throw new Exception('Token de acesso do Google não encontrado na resposta do fluxo de Usuário.');
            }

            $this->accessToken = $data['access_token'];
            return $this->accessToken;
        }

        // Se for Service Account (JWT Assertion)
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
        
        $headerMap = [
            'Authorization' => 'Bearer ' . $token,
            'Content-Type' => 'application/json'
        ];
        
        foreach ($headers as $h) {
            $parts = explode(':', $h, 2);
            if (count($parts) === 2) {
                $name = trim($parts[0]);
                $val = trim($parts[1]);
                $found = false;
                foreach ($headerMap as $k => $v) {
                    if (strcasecmp($k, $name) === 0) {
                        unset($headerMap[$k]);
                        $headerMap[$name] = $val;
                        $found = true;
                        break;
                    }
                }
                if (!$found) {
                    $headerMap[$name] = $val;
                }
            }
        }
        
        $finalHeaders = [];
        foreach ($headerMap as $name => $val) {
            $finalHeaders[] = "$name: $val";
        }
        
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $finalHeaders);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        
        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, is_string($body) ? $body : json_encode($body));
        }
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_errno($ch) ? curl_error($ch) : null;
        
        // Logar resposta bruta do Google Drive
        logBackendAudit("Chamada Google Drive: $method $endpoint | HTTP Status: $httpCode | cURL Error: " . ($curlError ?: 'Nenhum') . " | Body: " . $response);
        
        if ($curlError) {
            curl_close($ch);
            throw new Exception('Erro de rede (cURL) na chamada do Google Drive: ' . $curlError);
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
        $startBoundary = "--" . $boundary . "\r\n";
        $partBoundary = "\r\n--" . $boundary . "\r\n";
        $closeDelimiter = "\r\n--" . $boundary . "--";
        
        $fileData = file_get_contents($filePath);
        if ($fileData === false) {
            throw new Exception('Não foi possível ler o arquivo temporário ' . $filePath);
        }
        
        $body = $startBoundary
              . "Content-Type: application/json; charset=UTF-8\r\n\r\n"
              . json_encode($metadata)
              . $partBoundary
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

// -------------------------------------------------------------------------
// AUTHENTICATION AND SESSION SYNC ENDPOINTS
// -------------------------------------------------------------------------
if ($action === 'login') {
    $postData = file_get_contents('php://input');
    $user = json_decode($postData, true);
    if ($user && isset($user['id'])) {
        $_SESSION['user'] = $user;
        echo json_encode(['success' => true, 'user' => $_SESSION['user']]);
    } else {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Dados de usuário inválidos para login no backend']);
    }
    exit;
}

if ($action === 'logout') {
    unset($_SESSION['user']);
    session_destroy();
    echo json_encode(['success' => true]);
    exit;
}

if ($action === 'get_session') {
    echo json_encode(['success' => true, 'user' => $_SESSION['user'] ?? null]);
    exit;
}

// -------------------------------------------------------------------------
// GOOGLE DRIVE ACTION ENDPOINTS
// -------------------------------------------------------------------------
if ($action === 'create_folders') {
    $sessionUser = getAuthenticatedUser($dataDir);
    if (!$sessionUser) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Sessão expirada ou não autenticado.']);
        exit;
    }
    
    $caseId = $_GET['case_id'] ?? $_POST['case_id'] ?? '';
    $patientName = $_GET['patient_name'] ?? $_POST['patient_name'] ?? '';
    $dentistName = $_GET['dentist_name'] ?? $_POST['dentist_name'] ?? '';
    
    if (empty($caseId) || empty($patientName) || empty($dentistName)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Parâmetros ausentes (case_id, patient_name, dentist_name)']);
        exit;
    }
    
    $creds = getGoogleCredentials();
    $settingsFile = $dataDir . '/gdrive_shared_settings.json';
    if (!file_exists($settingsFile) || !$creds) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Google Drive não configurado no servidor.']);
        exit;
    }
    
    $settings = json_decode(file_get_contents($settingsFile), true);
    $rootFolderUrl = $settings['root_folder_url'] ?? '';
    $rootFolderId = getFolderIdFromUrl($rootFolderUrl);
    
    if (empty($rootFolderId)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Pasta raiz do Google Drive não configurada no servidor.']);
        exit;
    }
    
    try {
        $driver = new GoogleDriveServiceAccount(json_encode($creds));
        
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
        
        // Criar estrutura de pastas
        $dentistFolder = $driver->findOrCreateFolder($dentistName, $rootFolderId);
        $caseFolderName = $patientName . ' - ' . $caseId;
        $caseFolder = $driver->findOrCreateFolder($caseFolderName, $dentistFolder['id']);
        $caseFolderUrl = $caseFolder['webViewLink'] ?? ('https://drive.google.com/drive/folders/' . $caseFolder['id']);
        
        $imagesFolder = $driver->findOrCreateFolder('Imagens', $caseFolder['id']);
        $scanFolder = $driver->findOrCreateFolder('Escaneamento', $caseFolder['id']);
        $resultFolder = $driver->findOrCreateFolder('Enceramento Digital', $caseFolder['id']);
        $realResultFolder = $driver->findOrCreateFolder('Resultado', $caseFolder['id']);
        
        $updatedCaseObj = null;
        if ($caseIndex >= 0) {
            $cases[$caseIndex]['drive_status'] = 'created';
            $cases[$caseIndex]['drive_dentist_folder_id'] = $dentistFolder['id'];
            $cases[$caseIndex]['drive_case_folder_id'] = $caseFolder['id'];
            $cases[$caseIndex]['drive_images_folder_id'] = $imagesFolder['id'];
            $cases[$caseIndex]['drive_scan_folder_id'] = $scanFolder['id'];
            $cases[$caseIndex]['drive_result_folder_id'] = $resultFolder['id'];
            $cases[$caseIndex]['drive_real_result_folder_id'] = $realResultFolder['id'];
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
            'realResultFolderId' => $realResultFolder['id'],
            'caseFolderUrl' => $caseFolderUrl,
            'case' => $updatedCaseObj
        ]);
    } catch (Exception $e) {
        logBackendError("Erro ao criar pastas do caso $caseId: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

if ($action === 'test_drive') {
    $creds = getGoogleCredentials();
    if (!$creds) {
        echo json_encode(['success' => false, 'error' => 'Credencial não configurada']);
        exit;
    }
    
    $inputData = json_decode(file_get_contents('php://input'), true);
    $rootFolderUrl = $inputData['root_folder_url'] ?? '';
    if (empty($rootFolderUrl)) {
        $settingsFile = $dataDir . '/gdrive_shared_settings.json';
        if (file_exists($settingsFile)) {
            $settings = json_decode(file_get_contents($settingsFile), true);
            $rootFolderUrl = $settings['root_folder_url'] ?? '';
        }
    }
    
    $rootFolderId = getFolderIdFromUrl($rootFolderUrl);
    if (empty($rootFolderId)) {
        echo json_encode(['success' => false, 'error' => 'Pasta raiz não configurada']);
        exit;
    }
    
    try {
        // Test Google Authentication
        try {
            $driver = new GoogleDriveServiceAccount(json_encode($creds));
            $token = $driver->getAccessToken();
        } catch (Exception $e) {
            logBackendError("Falha de autenticação Google: " . $e->getMessage());
            echo json_encode(['success' => false, 'error' => 'Credencial inválida', 'debug' => $e->getMessage()]);
            exit;
        }
        
        // Test Root Folder Existence
        $res = $driver->request('/drive/v3/files/' . $rootFolderId . '?fields=id,name,trashed', 'GET');
        if ($res['status'] !== 200 || !empty($res['data']['trashed'])) {
            logBackendError("Pasta raiz não encontrada no Drive: HTTP " . $res['status'] . " - " . $res['body']);
            echo json_encode(['success' => false, 'error' => 'Pasta raiz não encontrada']);
            exit;
        }
        
        // Test Write Permission (Create temporary folder)
        $tempFolderName = 'temp_test_' . uniqid();
        $body = [
            'name' => $tempFolderName,
            'mimeType' => 'application/vnd.google-apps.folder',
            'parents' => [$rootFolderId]
        ];
        
        $createRes = $driver->request('/drive/v3/files?fields=id,name', 'POST', $body);
        if ($createRes['status'] !== 200 || empty($createRes['data']['id'])) {
            logBackendError("Sem permissão de escrita na pasta raiz do Drive: HTTP " . $createRes['status'] . " - " . $createRes['body']);
            echo json_encode(['success' => false, 'error' => 'Sem permissão na pasta raiz']);
            exit;
        }
        
        $tempFolderId = $createRes['data']['id'];
        
        // Delete temporary folder
        $driver->request('/drive/v3/files/' . $tempFolderId, 'DELETE');
        
        echo json_encode([
            'success' => true,
            'message' => 'Google Drive conectado e operacional',
            'details' => 'Conexão validada com sucesso (Autenticação OK, Acesso à Pasta OK, Permissão de Escrita OK).'
        ]);
        
    } catch (Exception $e) {
        logBackendError("Erro operacional no teste de conexão com Google Drive: " . $e->getMessage());
        echo json_encode(['success' => false, 'error' => 'Erro operacional no teste de conexão', 'debug' => $e->getMessage()]);
    }
    exit;
}

if ($action === 'view_drive_structure') {
    $sessionUser = getAuthenticatedUser($dataDir);
    if (!$sessionUser) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Sessão expirada ou não autenticado.']);
        exit;
    }
    
    $creds = getGoogleCredentials();
    if (!$creds) {
        echo json_encode(['success' => false, 'error' => 'Credencial não configurada']);
        exit;
    }
    
    $settingsFile = $dataDir . '/gdrive_shared_settings.json';
    if (!file_exists($settingsFile)) {
        echo json_encode(['success' => false, 'error' => 'Configurações de pasta raiz do Drive ausentes']);
        exit;
    }
    
    $settings = json_decode(file_get_contents($settingsFile), true);
    $rootFolderUrl = $settings['root_folder_url'] ?? '';
    $rootFolderId = getFolderIdFromUrl($rootFolderUrl);
    
    if (empty($rootFolderId)) {
        echo json_encode(['success' => false, 'error' => 'Pasta raiz não configurada']);
        exit;
    }
    
    try {
        $driver = new GoogleDriveServiceAccount(json_encode($creds));
        
        // Obter detalhes da pasta raiz
        $rootRes = $driver->request('/drive/v3/files/' . $rootFolderId . '?fields=id,name', 'GET');
        if ($rootRes['status'] !== 200) {
            echo json_encode(['success' => false, 'error' => 'Não foi possível acessar a pasta raiz.']);
            exit;
        }
        $rootName = $rootRes['data']['name'] ?? 'Pasta Raiz';
        
        // Listar pastas de dentistas na pasta raiz
        $query = "'" . $rootFolderId . "' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false";
        $listRes = $driver->request('/drive/v3/files?q=' . urlencode($query) . '&fields=files(id,name)&pageSize=100', 'GET');
        
        if ($listRes['status'] !== 200) {
            echo json_encode(['success' => false, 'error' => 'Não foi possível listar as pastas do Google Drive.']);
            exit;
        }
        
        $dentistFolders = $listRes['data']['files'] ?? [];
        
        // Carregar casos locais e perfis
        $casesFile = $dataDir . '/matheus_protese_cases.json';
        $cases = [];
        if (file_exists($casesFile)) {
            $cases = json_decode(file_get_contents($casesFile), true) ?: [];
        }
        
        $profilesFile = $dataDir . '/matheus_protese_profiles.json';
        $profiles = [];
        if (file_exists($profilesFile)) {
            $profiles = json_decode(file_get_contents($profilesFile), true) ?: [];
        }
        
        // Normalizar dentistas
        $dentistNameToId = [];
        foreach ($profiles as $p) {
            if (($p['role'] ?? '') === 'dentist') {
                $dentistNameToId[$p['full_name']] = $p['id'];
            }
        }
        
        $foldersResult = [];
        foreach ($dentistFolders as $folder) {
            $folderName = $folder['name'];
            $folderId = $folder['id'];
            
            $dentistId = null;
            foreach ($dentistNameToId as $name => $id) {
                if (strcasecmp($name, $folderName) === 0) {
                    $dentistId = $id;
                    break;
                }
            }
            
            $casesCount = 0;
            if ($dentistId) {
                foreach ($cases as $c) {
                    if (($c['dentist_id'] ?? '') === $dentistId) {
                        $casesCount++;
                    }
                }
            }
            
            $foldersResult[] = [
                'id' => $folderId,
                'name' => $folderName,
                'cases_count' => $casesCount,
                'mapped_dentist_id' => $dentistId
            ];
        }
        
        usort($foldersResult, function($a, $b) {
            return strcasecmp($a['name'], $b['name']);
        });
        
        echo json_encode([
            'success' => true,
            'root_folder' => [
                'id' => $rootFolderId,
                'name' => $rootName
            ],
            'dentist_folders' => $foldersResult
        ]);
        
    } catch (Exception $e) {
        logBackendError("Erro ao obter estrutura do Drive: " . $e->getMessage());
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
    
    // Validar se arquivo está presente e sem erro
    if (!isset($_FILES['file'])) {
        logBackendError("Tentativa de upload sem arquivo.");
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Nenhum arquivo enviado']);
        exit;
    }
    
    $fileError = $_FILES['file']['error'];
    if ($fileError !== UPLOAD_ERR_OK) {
        $uploadErrors = [
            UPLOAD_ERR_INI_SIZE   => 'O arquivo excede o limite máximo permitido pelo servidor (upload_max_filesize).',
            UPLOAD_ERR_FORM_SIZE  => 'O arquivo excede o limite MAX_FILE_SIZE do formulário.',
            UPLOAD_ERR_PARTIAL    => 'O upload do arquivo foi feito apenas parcialmente.',
            UPLOAD_ERR_NO_FILE    => 'Nenhum arquivo foi enviado.',
            UPLOAD_ERR_NO_TMP_DIR => 'Falta a pasta temporária para salvamento.',
            UPLOAD_ERR_CANT_WRITE => 'Falha ao gravar o arquivo no disco do servidor.',
            UPLOAD_ERR_EXTENSION  => 'Uma extensão do PHP interrompeu o upload do arquivo.'
        ];
        $errorMsg = $uploadErrors[$fileError] ?? 'Erro desconhecido no upload do arquivo.';
        logBackendError("Erro de upload PHP ($fileError): $errorMsg");
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => $errorMsg]);
        exit;
    }
    
    $tmpName = $_FILES['file']['tmp_name'] ?? '';
    $fileName = $_FILES['file']['name'] ?? '';
    $mimeType = $_FILES['file']['type'] ?? '';
    $fileSize = $_FILES['file']['size'] ?? 0;
    
    if (empty($tmpName) || !is_uploaded_file($tmpName)) {
        logBackendError("Arquivo temporário inválido ou não enviado por POST.");
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Arquivo temporário inválido.']);
        exit;
    }
    
    $fileContent = @file_get_contents($tmpName);
    if ($fileContent === false) {
        logBackendError("Falha ao ler arquivo temporário: $tmpName");
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Não foi possível ler o arquivo temporário.']);
        exit;
    }
    
    // Obter case_id do formulário
    $caseId = $_POST['case_id'] ?? '';
    if (empty($caseId)) {
        logBackendError("Tentativa de upload sem case_id.");
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'ID do caso ausente.']);
        exit;
    }
    
    // Validar Sessão de Usuário ou Header
    $sessionUser = getAuthenticatedUser($dataDir);
    if (!$sessionUser || !isset($sessionUser['id'])) {
        // Collect debug info
        $headersInfo = function_exists('getallheaders') ? getallheaders() : [];
        $serverUserId = $_SERVER['HTTP_X_USER_ID'] ?? 'not set';
        $postUserId = $_POST['user_id'] ?? 'not set';
        $getUserId = $_GET['user_id'] ?? 'not set';
        $sessInfo = isset($_SESSION['user']) ? json_encode($_SESSION['user']) : 'not set';
        logBackendError("Upload negado: sessão expirada ou usuário não autenticado. Debug - Headers: " . json_encode($headersInfo) . " | Server X-User-Id: " . $serverUserId . " | GET User-Id: " . $getUserId . " | POST User-Id: " . $postUserId . " | Session User: " . $sessInfo);
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Sessão expirada. Por favor, faça login novamente.']);
        exit;
    }
    
    $userId = $sessionUser['id'];
    $userRole = $sessionUser['role'] ?? 'dentist';
    $userName = $sessionUser['full_name'] ?? 'Desconhecido';
    
    // Carregar informações do Caso
    $casesFile = $dataDir . '/matheus_protese_cases.json';
    if (!file_exists($casesFile)) {
        logBackendError("Arquivo de banco de casos não existe: $casesFile");
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Erro interno de banco de dados no servidor.']);
        exit;
    }
    
    $cases = json_decode(file_get_contents($casesFile), true) ?: [];
    $caseObj = null;
    $caseIndex = -1;
    foreach ($cases as $idx => $c) {
        if ($c['id'] === $caseId) {
            $caseObj = $c;
            $caseIndex = $idx;
            break;
        }
    }
    
    if (!$caseObj) {
        logBackendError("Caso $caseId não encontrado no banco.");
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Caso não encontrado.']);
        exit;
    }
    
    $dentistIdFromCase = $caseObj['dentist_id'] ?? '';
    $patientNameFromCase = $caseObj['patient_name'] ?? 'Sem Nome';
    
    // Validação de Permissão: Dentista só envia para seu próprio caso
    if ($userRole === 'dentist' && $userId !== $dentistIdFromCase) {
        logBackendError("Dentista tentou fazer upload para caso que não lhe pertence.", [
            'logged_user' => $userId,
            'case_id' => $caseId,
            'owner_dentist' => $dentistIdFromCase
        ]);
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Acesso negado: você não tem permissão para enviar arquivos para este caso.']);
        exit;
    }
    
    // Resolver nome oficial do dentista do caso
    $profilesFile = $dataDir . '/matheus_protese_profiles.json';
    $dentistName = 'Dentista Desconhecido';
    if (file_exists($profilesFile)) {
        $profiles = json_decode(file_get_contents($profilesFile), true) ?: [];
        foreach ($profiles as $p) {
            if ($p['id'] === $dentistIdFromCase) {
                $dentistName = $p['full_name'];
                break;
            }
        }
    }
    
    // Resolver Categoria e Extensão automaticamente
    $pathInfo = pathinfo($fileName);
    $ext = isset($pathInfo['extension']) ? strtolower($pathInfo['extension']) : '';
    
    $category = 'imagens';
    if ($userRole === 'dentist') {
        $imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'heic', 'heif', 'tiff'];
        if (in_array($ext, $imageExtensions)) {
            $category = 'imagens';
        } else {
            $category = 'escaneamento';
        }
    } else {
        // Admin / Secretary
        $designExtensions = ['stl', 'obj', 'ply', '3dx', 'dcm'];
        if (in_array($ext, $designExtensions)) {
            $category = 'enceramento_digital';
        } else {
            $category = 'resultado';
        }
    }
    
    // Obter credenciais do Google Drive
    $creds = getGoogleCredentials();
    $settingsFile = $dataDir . '/gdrive_shared_settings.json';
    if (!file_exists($settingsFile) || !$creds) {
        logBackendError("Google Drive não configurado no servidor.");
        http_response_code(500);
        echo json_encode(['success' => false, 'stage' => 'validation', 'error' => 'Integração com o Google Drive não está configurada no servidor.']);
        exit;
    }
    
    $settings = json_decode(file_get_contents($settingsFile), true);
    $rootFolderUrl = $settings['root_folder_url'] ?? '';
    $rootFolderId = getFolderIdFromUrl($rootFolderUrl);
    
    if (empty($rootFolderId)) {
        logBackendError("Pasta raiz do Drive não configurada.");
        http_response_code(500);
        echo json_encode(['success' => false, 'stage' => 'validation', 'error' => 'Pasta raiz do Google Drive não configurada.']);
        exit;
    }
    
    $stage = 'validation';
    try {
        $driver = new GoogleDriveServiceAccount(json_encode($creds));
        
        $stage = 'folder_verification';
        // Criar pastas do dentista e do caso caso não existam
        $driveStatus = $caseObj['drive_status'] ?? 'not_created';
        $driveDentistFolderId = $caseObj['drive_dentist_folder_id'] ?? null;
        $driveCaseFolderId = $caseObj['drive_case_folder_id'] ?? null;
        $driveImagesFolderId = $caseObj['drive_images_folder_id'] ?? null;
        $driveScanFolderId = $caseObj['drive_scan_folder_id'] ?? null;
        $driveResultFolderId = $caseObj['drive_result_folder_id'] ?? null;
        $driveRealResultFolderId = $caseObj['drive_real_result_folder_id'] ?? null;
        $driveCaseFolderUrl = $caseObj['drive_case_folder_url'] ?? null;
        
        if ($driveStatus !== 'created' || empty($driveCaseFolderId)) {
            $dentistFolder = $driver->findOrCreateFolder($dentistName, $rootFolderId);
            $driveDentistFolderId = $dentistFolder['id'];
            
            $caseFolderName = $patientNameFromCase . ' - ' . $caseId;
            $caseFolder = $driver->findOrCreateFolder($caseFolderName, $driveDentistFolderId);
            $driveCaseFolderId = $caseFolder['id'];
            $driveCaseFolderUrl = $caseFolder['webViewLink'] ?? ('https://drive.google.com/drive/folders/' . $driveCaseFolderId);
            
            $imagesFolder = $driver->findOrCreateFolder('Imagens', $driveCaseFolderId);
            $driveImagesFolderId = $imagesFolder['id'];
            
            $scanFolder = $driver->findOrCreateFolder('Escaneamento', $driveCaseFolderId);
            $driveScanFolderId = $scanFolder['id'];
            
            $resultFolder = $driver->findOrCreateFolder('Enceramento Digital', $driveCaseFolderId);
            $driveResultFolderId = $resultFolder['id'];
            
            $realResultFolder = $driver->findOrCreateFolder('Resultado', $driveCaseFolderId);
            $driveRealResultFolderId = $realResultFolder['id'];
            
            $driveStatus = 'created';
            
            if ($caseIndex >= 0) {
                $cases[$caseIndex]['drive_status'] = 'created';
                $cases[$caseIndex]['drive_dentist_folder_id'] = $driveDentistFolderId;
                $cases[$caseIndex]['drive_case_folder_id'] = $driveCaseFolderId;
                $cases[$caseIndex]['drive_images_folder_id'] = $driveImagesFolderId;
                $cases[$caseIndex]['drive_scan_folder_id'] = $driveScanFolderId;
                $cases[$caseIndex]['drive_result_folder_id'] = $driveResultFolderId;
                $cases[$caseIndex]['drive_real_result_folder_id'] = $driveRealResultFolderId;
                $cases[$caseIndex]['drive_case_folder_url'] = $driveCaseFolderUrl;
                $cases[$caseIndex]['google_drive_folder_url'] = $driveCaseFolderUrl;
                $cases[$caseIndex]['google_drive_folder_id'] = $driveCaseFolderId;
                $cases[$caseIndex]['updated_at'] = gmdate('Y-m-d\TH:i:s') . '.000Z';
                
                if (file_put_contents($casesFile, json_encode($cases, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) === false) {
                    throw new Exception("Falha ao salvar as informações das pastas do caso no banco local.");
                }
            }
        }
        
        // Se a subpasta de "Resultado" ou "Enceramento Digital" estiver vazia nas configurações salvas do caso, certificar
        if (empty($driveRealResultFolderId)) {
            $realResultFolder = $driver->findOrCreateFolder('Resultado', $driveCaseFolderId);
            $driveRealResultFolderId = $realResultFolder['id'];
            if ($caseIndex >= 0) {
                $cases[$caseIndex]['drive_real_result_folder_id'] = $driveRealResultFolderId;
                if (file_put_contents($casesFile, json_encode($cases, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) === false) {
                    throw new Exception("Falha ao salvar a pasta de resultado no banco local.");
                }
            }
        }
        
        // Obter ID da pasta de destino correspondente
        $targetFolderId = null;
        $targetFolderName = '';
        if ($category === 'imagens') {
            $targetFolderId = $driveImagesFolderId;
            $targetFolderName = 'Imagens';
        } else if ($category === 'escaneamento') {
            $targetFolderId = $driveScanFolderId;
            $targetFolderName = 'Escaneamento';
        } else if ($category === 'enceramento_digital') {
            $targetFolderId = $driveResultFolderId;
            $targetFolderName = 'Enceramento Digital';
        } else if ($category === 'resultado') {
            $targetFolderId = $driveRealResultFolderId;
            $targetFolderName = 'Resultado';
        }
        
        if (empty($targetFolderId)) {
            // Se o ID da pasta estiver vazio, cria no Drive e atualiza o JSON local
            $subFolder = $driver->findOrCreateFolder($targetFolderName, $driveCaseFolderId);
            $targetFolderId = $subFolder['id'];
            if ($caseIndex >= 0) {
                if ($category === 'imagens') $cases[$caseIndex]['drive_images_folder_id'] = $targetFolderId;
                else if ($category === 'escaneamento') $cases[$caseIndex]['drive_scan_folder_id'] = $targetFolderId;
                else if ($category === 'enceramento_digital') $cases[$caseIndex]['drive_result_folder_id'] = $targetFolderId;
                else if ($category === 'resultado') $cases[$caseIndex]['drive_real_result_folder_id'] = $targetFolderId;
                file_put_contents($casesFile, json_encode($cases, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            }
        } else {
            // Validar se o ID da subpasta realmente existe e não está na lixeira
            try {
                $checkFolderRes = $driver->request('/drive/v3/files/' . $targetFolderId . '?fields=id,name,trashed', 'GET');
                if ($checkFolderRes['status'] !== 200 || !empty($checkFolderRes['data']['trashed'])) {
                    // Pasta foi excluída ou está na lixeira. Vamos recriá-la!
                    $subFolder = $driver->findOrCreateFolder($targetFolderName, $driveCaseFolderId);
                    $targetFolderId = $subFolder['id'];
                    
                    if ($caseIndex >= 0) {
                        if ($category === 'imagens') $cases[$caseIndex]['drive_images_folder_id'] = $targetFolderId;
                        else if ($category === 'escaneamento') $cases[$caseIndex]['drive_scan_folder_id'] = $targetFolderId;
                        else if ($category === 'enceramento_digital') $cases[$caseIndex]['drive_result_folder_id'] = $targetFolderId;
                        else if ($category === 'resultado') $cases[$caseIndex]['drive_real_result_folder_id'] = $targetFolderId;
                        file_put_contents($casesFile, json_encode($cases, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
                    }
                }
            } catch (Exception $e) {
                // Em caso de erro na validação, buscamos ou criamos para garantir a integridade
                $subFolder = $driver->findOrCreateFolder($targetFolderName, $driveCaseFolderId);
                $targetFolderId = $subFolder['id'];
            }
        }
        
        // Antes de chamar o Google Drive, gravar log com informações detalhadas
        logBackendAudit("Iniciando upload para o Google Drive.", [
            'original_file_name' => $fileName,
            'file_size' => $fileSize,
            'tmp_name' => $tmpName,
            'case_id' => $caseId,
            'target_folder_id' => $targetFolderId,
            'resolved_category' => $category
        ]);
        
        $stage = 'drive_upload';
        // Enviar arquivo para o Google Drive
        $driveFile = $driver->uploadFile(
            $tmpName,
            $fileName,
            $mimeType,
            $targetFolderId
        );
        
        $stage = 'database_save';
        // Salvar metadados no arquivo JSON de anexos local
        $attachmentsFile = $dataDir . '/matheus_protese_attachments.json';
        $attachments = [];
        if (file_exists($attachmentsFile)) {
            $attachments = json_decode(file_get_contents($attachmentsFile), true) ?: [];
        }
        
        // Validar se o arquivo de anexos possui permissão de escrita
        if (file_exists($attachmentsFile) && !is_writable($attachmentsFile)) {
            throw new Exception("Sem permissão de escrita no arquivo local de anexos: $attachmentsFile");
        }
        
        $attachmentId = 'att-' . time() . '-' . substr(md5(uniqid()), 0, 9);
        $newAttachment = [
            'id' => $attachmentId,
            'case_id' => $caseId,
            'google_drive_file_id' => $driveFile['id'],
            'file_name' => $driveFile['name'] ?? $fileName,
            'file_size' => $fileSize,
            'mime_type' => $driveFile['mimeType'] ?? $mimeType,
            'uploaded_by' => $userId,
            'created_at' => gmdate('Y-m-d\TH:i:s') . '.000Z',
            'folder_id' => $targetFolderId,
            'web_view_link' => $driveFile['webViewLink'] ?? null,
            'file_category' => $category
        ];
        
        $attachments[] = $newAttachment;
        if (file_put_contents($attachmentsFile, json_encode($attachments, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) === false) {
            throw new Exception("Falha ao salvar anexo no banco de dados local.");
        }
        
        // Registrar atividade no log de auditoria do sistema
        logBackendAudit("Arquivo enviado com sucesso.", [
            'user' => $userId,
            'user_name' => $userName,
            'case_id' => $caseId,
            'file_id' => $driveFile['id'],
            'file_name' => $fileName,
            'file_size' => $fileSize,
            'category' => $category,
            'target_folder' => $targetFolderName
        ]);
        
        // Logar histórico de caso no JSON matheus_protese_history
        $historyFile = $dataDir . '/matheus_protese_history.json';
        $historyLogs = [];
        if (file_exists($historyFile)) {
            $historyLogs = json_decode(file_get_contents($historyFile), true) ?: [];
        }
        $historyLogs[] = [
            'id' => 'h-' . time() . '-' . substr(md5(uniqid()), 0, 9),
            'case_id' => $caseId,
            'user_id' => $userId,
            'action' => 'upload_arquivo',
            'new_data' => [
                'file_name' => $fileName,
                'category' => $category,
                'file_size' => $fileSize
            ],
            'created_at' => gmdate('Y-m-d\TH:i:s') . '.000Z'
        ];
        if (file_put_contents($historyFile, json_encode($historyLogs, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) === false) {
            throw new Exception("Falha ao gravar registro no histórico local do caso.");
        }
        
        // Recarregar caso atualizado
        $updatedCaseObj = null;
        $updatedCases = json_decode(file_get_contents($casesFile), true) ?: [];
        foreach ($updatedCases as $uc) {
            if ($uc['id'] === $caseId) {
                $updatedCaseObj = $uc;
                break;
            }
        }
        
        echo json_encode([
            'success' => true,
            'file' => [
                'id' => $driveFile['id'],
                'name' => $driveFile['name'] ?? $fileName,
                'mimeType' => $driveFile['mimeType'] ?? $mimeType,
                'size' => $driveFile['size'] ?? $fileSize,
                'webViewLink' => $driveFile['webViewLink'] ?? null
            ],
            'attachment' => $newAttachment,
            'case' => $updatedCaseObj
        ]);
        
    } catch (Exception $e) {
        logBackendError("Erro no upload do Google Drive (estágio: $stage): " . $e->getMessage(), [
            'user' => $userId,
            'case_id' => $caseId,
            'file_name' => $fileName
        ]);
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'stage' => $stage,
            'error' => $e->getMessage(),
            'google_response' => ($stage === 'drive_upload' ? $e->getMessage() : null)
        ]);
    }
    exit;
}

// -------------------------------------------------------------------------
// PERSISTÊNCIA GENÉRICA DOS DADOS
// -------------------------------------------------------------------------
// Validar chave para evitar Directory Traversal
if (empty($key) || !preg_match('/^[a-zA-Z0-9_-]+$/', $key)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Chave inválida ou vazia']);
    exit;
}

// Interceptar escrita/leitura do gdrive_shared_settings
if ($key === 'gdrive_shared_settings') {
    if ($_SERVER['REQUEST_METHOD'] === 'POST' || $action === 'set') {
        $postData = file_get_contents('php://input');
        $jsonData = json_decode($postData, true);
        if ($jsonData === null) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'JSON inválido']);
            exit;
        }
        
        $serviceAccountJson = $jsonData['service_account_json'] ?? '';
        $rootFolderUrl = $jsonData['root_folder_url'] ?? '';
        
        // Se uma credencial JSON válida foi fornecida
        if (!empty($serviceAccountJson) && $serviceAccountJson !== '********' && !preg_match('/^\(.*\)$/', $serviceAccountJson)) {
            $creds = json_decode($serviceAccountJson, true);
            if (!$creds || !isset($creds['private_key']) || !isset($creds['client_email'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Chave JSON de Conta de Serviço inválida. Verifique o conteúdo.']);
                exit;
            }
            
            // Salvar no arquivo privado fora da pasta public
            $privateFile = __DIR__ . '/../database/gdrive_private_credentials.json';
            if (!file_exists(dirname($privateFile))) {
                mkdir(dirname($privateFile), 0777, true);
            }
            file_put_contents($privateFile, json_encode($creds, JSON_PRETTY_PRINT));
            logBackendAudit("Novas credenciais da Service Account salvas com sucesso.");
        }
        
        // Salvar configurações públicas
        $creds = getGoogleCredentials();
        $publicSettings = [
            'root_folder_url' => $rootFolderUrl,
            'client_email' => $creds ? ($creds['client_email'] ?? '') : '',
            'project_id' => $creds ? ($creds['project_id'] ?? '') : '',
        ];
        
        $settingsFile = $dataDir . '/gdrive_shared_settings.json';
        file_put_contents($settingsFile, json_encode($publicSettings, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        
        echo json_encode([
            'success' => true,
            'key' => $key,
            'data' => getGDrivePublicSettings($dataDir)
        ]);
        exit;
    }
    
    // GET
    echo json_encode([
        'success' => true,
        'key' => $key,
        'data' => getGDrivePublicSettings($dataDir)
    ]);
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
