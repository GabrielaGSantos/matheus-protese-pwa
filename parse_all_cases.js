import XLSX from 'xlsx';
import fs from 'fs';

const filePath = 'C:\\Users\\Gabriela\\Downloads\\Entradas Traldi Planning.xlsx';
const workbook = XLSX.readFile(filePath);

// All sheets representing case entries
const targetSheets = [
  'Maio26', 'Abril26', 'Março26', 'Fevereiro26', 'Janeiro26',
  'Dezembro25', 'Novembro25', 'Outubro25', 'Setembro25', 'Agosto25',
  'Junho e Julho25', 'Abril25', 'Março25'
];

// Excel serial date to ISO string
const getJsDate = (excelSerial) => {
  if (!excelSerial) return new Date().toISOString();
  if (typeof excelSerial === 'string') {
    // If it's already a date string
    const d = new Date(excelSerial);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }
  // Convert serial to JS date
  const date = new Date(Math.round((excelSerial - 25569) * 86400 * 1000));
  return date.toISOString();
};

const allCases = [];
let caseCount = 1;

// Map Sheet Dentist names to our seeded profiles or generate ids
const dentistNameMap = {};
const mockDentistsNames = [
  'Dr Allan', 'Dra Monique/Iasmim', 'Dr Lucas', 'Dr Andrey', 'Dr Tiago', 'Dra Fabiane',
  'Matheus Maldonado', 'Dr Marcus Paulo', 'Dr Pedro Echner', 'Dr Anderson', 'Dra Kerollen',
  'Dr Gustavo B', 'Dr Iuri Silveira', 'Dr Ricardo', 'Dr Mateus Tonetto', 'Dr Jose Diniz',
  'Marcio Kazikawa', 'Dr Fabricio Ferreira', 'Gustavo Damiani', 'Dra Isabela',
  'Dra Laura Vieira', 'Dr Gustavo D', 'Dra Francielly', 'Dra Monique'
];

mockDentistsNames.forEach((name, idx) => {
  const normName = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
  dentistNameMap[normName] = `dentist-${idx + 1}`;
});

targetSheets.forEach(sheetName => {
  if (!workbook.SheetNames.includes(sheetName)) return;
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet);

  rows.forEach((row, idx) => {
    const dentistName = String(row['Cliente'] || 'Desconhecido');
    const normDentistName = dentistName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
    
    // Find matching dentist_id or assign a generic one
    let dentistId = dentistNameMap[normDentistName];
    if (!dentistId) {
      // Create a unique new dentist ID if not found
      dentistId = `dentist-dynamic-${normDentistName || 'unknown'}`;
    }

    const rawDate = row['Data Recebido'];
    const isoDateStr = getJsDate(rawDate);
    const datePart = isoDateStr.split('T')[0];
    const yearMonth = datePart.slice(0, 7).replace('-', '');

    const caseId = `CASE-${yearMonth}-${String(caseCount++).padStart(4, '0')}`;
    
    const valueMatheus = parseFloat(row['Valor Matheus']) || 0;
    const valuePlanning = parseFloat(row['Valor Planning']) || 0;
    const valuePaschoal = parseFloat(row['Valor Paschoal']) || 0;
    const costAllanMatheus = parseFloat(row['Allan/Matheus']) || 0;
    const costAllanSolo = parseFloat(row['Allan Solo']) || 0;
    const costAndrey = parseFloat(row['Andrey']) || 0;
    
    const calculatedTotal = valueMatheus + valuePlanning + valuePaschoal;
    const statusText = String(row['Status'] || 'Aguardando Pagamento').toLowerCase();
    
    let financialStatus = 'aguardando_pagamento';
    if (statusText.includes('pago')) {
      financialStatus = 'pago';
    } else if (statusText.includes('isento')) {
      financialStatus = 'isento';
    }

    allCases.push({
      id: caseId,
      dentist_id: dentistId,
      patient_name: String(row['Paciente'] || 'Sem Nome'),
      created_at: isoDateStr,
      requested_delivery_date: datePart,
      final_delivery_date: datePart,
      status: 'finalizado', // historical cases are finalized
      financial_status: financialStatus,
      teeth_selection: { teeth: [], type: 'individual' },
      dentist_notes: String(row['Observações'] || ''),
      internal_notes: `Feito por: ${row['Feito por'] || 'N/A'}`,
      has_photo: false,
      has_file: false,
      estimated_hours: 0,
      value_matheus: valueMatheus,
      value_planning: valuePlanning,
      value_paschoal: valuePaschoal,
      cost_allan_matheus: costAllanMatheus,
      cost_allan_solo: costAllanSolo,
      cost_andrey: costAndrey,
      other_internal_costs: [],
      total_value: calculatedTotal,
      paid_value: financialStatus === 'pago' ? calculatedTotal : 0,
      remaining_value: financialStatus === 'pago' ? 0 : calculatedTotal,
      google_drive_folder_id: `folder-imported-${idx}`,
      google_drive_folder_url: 'https://drive.google.com',
      updated_at: isoDateStr
    });
  });
});

fs.writeFileSync('imported_cases.json', JSON.stringify(allCases, null, 2));
console.log(`Parsed and saved ${allCases.length} cases successfully to imported_cases.json!`);
