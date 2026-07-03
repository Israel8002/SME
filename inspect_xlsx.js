const ExcelJS = require('exceljs');
const path = require('path');

async function main() {
  const workbook = new ExcelJS.Workbook();
  const filePath = "c:\\Users\\israel.diaz\\Desktop\\MOBILE APP IMSS\\Sistema de Monitoreo de Enlaces\\Unidades con segmentos de red.xlsx";
  
  console.log('Loading workbook from:', filePath);
  await workbook.xlsx.readFile(filePath);
  
  console.log('Worksheets:');
  workbook.worksheets.forEach((sheet, idx) => {
    console.log(`- Index ${idx}: ${sheet.name} (${sheet.rowCount} rows, ${sheet.columnCount} columns)`);
  });

  // Let's print the first sheet's first 10 rows
  const sheet = workbook.worksheets[0];
  console.log(`\nFirst sheet: ${sheet.name}`);
  for (let i = 1; i <= Math.min(sheet.rowCount, 15); i++) {
    const row = sheet.getRow(i);
    const vals = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      vals.push(cell.value);
    });
    console.log(`Row ${i}:`, JSON.stringify(vals));
  }
}

main().catch(console.error);
