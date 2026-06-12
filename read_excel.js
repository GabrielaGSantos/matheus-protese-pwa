import XLSX from 'xlsx';

const filePath = 'C:\\Users\\Gabriela\\Downloads\\Entradas Traldi Planning.xlsx';

try {
  const workbook = XLSX.readFile(filePath);
  const sheetNames = workbook.SheetNames;
  console.log('Sheet Names:', sheetNames);

  // Read first sheet
  const firstSheetName = sheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);
  
  console.log('Columns of first sheet:', Object.keys(data[0] || {}));
  console.log('Total rows:', data.length);
  console.log('First 3 rows:');
  console.log(JSON.stringify(data.slice(0, 3), null, 2));
} catch (error) {
  console.error('Error reading excel file:', error);
}
