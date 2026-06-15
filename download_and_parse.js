import https from 'https';
import fs from 'fs';
import XLSX from 'xlsx';

const sheetUrl = 'https://docs.google.com/spreadsheets/d/14ghxaHfmqXGPqIqfYu5vVd1rBTiSfzutw4esOTfd_tQ/export?format=xlsx';
const outputFilePath = 'C:\\Users\\Gabriela\\.gemini\\antigravity-ide\\scratch\\matheus-protese-pwa\\Entradas.xlsx';

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        console.log(`Redirecting to: ${response.headers.location}`);
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: Status Code ${response.statusCode}`));
        return;
      }

      const file = fs.createWriteStream(destPath);
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          resolve();
        });
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

console.log('Downloading spreadsheet...');
downloadFile(sheetUrl, outputFilePath)
  .then(() => {
    console.log('Download complete.');
    try {
      const workbook = XLSX.readFile(outputFilePath);
      console.log('Sheet Names:', workbook.SheetNames);
      
      const firstSheet = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheet];
      const rows = XLSX.utils.sheet_to_json(worksheet);
      console.log(`Sample row from sheet ${firstSheet}:`, rows[0]);
    } catch (err) {
      console.error('Error reading workbook:', err);
    }
  })
  .catch((err) => {
    console.error('Error:', err);
  });
