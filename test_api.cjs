const fs = require('fs');
const path = require('path');

async function testUpload() {
  const filePath = path.join(__dirname, 'test_upload_2.txt');
  fs.writeFileSync(filePath, 'Arquivo de teste de sincronização do Google Drive.');
  const fileBuffer = fs.readFileSync(filePath);

  console.log("Starting test upload to api.php...");
  
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: 'text/plain' });
  formData.append('file', blob, 'test_upload_2.txt');
  formData.append('case_id', 'CASE-202606-0002');
  formData.append('user_id', 'dentist-1');

  try {
    const response = await fetch('http://localhost/matheus-protese-pwa/public/api.php?action=upload_file&user_id=dentist-1', {
      method: 'POST',
      headers: {
        'X-User-Id': 'dentist-1'
      },
      body: formData
    });

    const text = await response.text();
    console.log("HTTP Status:", response.status);
    console.log("Response content:", text);
    
    try {
      const json = JSON.parse(text);
      if (json.success) {
        console.log("✅ UPLOAD SUCCESSFUL!");
        console.log("Drive File ID:", json.file.id);
        console.log("View Link:", json.file.webViewLink);
      } else {
        console.log("❌ UPLOAD FAILED:", json.error);
      }
    } catch (e) {
      console.log("Response is not JSON.");
    }
  } catch (err) {
    console.error("Network error:", err);
  } finally {
    try { fs.unlinkSync(filePath); } catch (e) {}
  }
}

testUpload();
