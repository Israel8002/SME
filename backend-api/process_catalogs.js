const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const CATALOGO_PATH = path.join(__dirname, '..', 'CATALOGO.txt');
const XLSX_PATH = "c:\\Users\\israel.diaz\\Desktop\\MOBILE APP IMSS\\Sistema de Monitoreo de Enlaces\\Unidades con segmentos de red.xlsx";

function parseJSArray(content, name) {
  const regex = new RegExp(`export const ${name}(?:\\s*:\\s*[\\w\\[\\]]+)?\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*;`, "i");
  const match = content.match(regex);
  if (!match) {
    throw new Error(`Could not find array "${name}" in CATALOGO.txt`);
  }
  const arrayBody = match[1]
    .replace(/\/\/.*/g, "") // remove line comments
    .replace(/\/\*[\s\S]*?\*\//g, ""); // remove block comments
  
  try {
    return new Function(`return [${arrayBody}]`)();
  } catch (err) {
    throw new Error(`Failed to evaluate array "${name}": ${err.message}`);
  }
}

async function main() {
  const catalogoContent = fs.readFileSync(CATALOGO_PATH, "utf8");
  const cities = parseJSArray(catalogoContent, "cities");
  const units = parseJSArray(catalogoContent, "units");
  const rooms = parseJSArray(catalogoContent, "rooms");

  console.log(`Parsed CATALOGO.txt: ${cities.length} cities, ${units.length} units, ${rooms.length} rooms`);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(XLSX_PATH);
  const sheet = workbook.worksheets[0];

  const xlsxUnits = [];
  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const id = row.getCell(1).value;
    const nombre = row.getCell(2).value;
    const segmentos = row.getCell(3).value;
    if (id) {
      xlsxUnits.push({ id: Number(id), nombre, segmentos });
    }
  }

  console.log(`Parsed Excel: ${xlsxUnits.length} units`);

  // Let's find matches and mismatches
  const txtUnitIds = new Set(units.map(u => u.id));
  const xlsxUnitIds = new Set(xlsxUnits.map(u => u.id));

  const onlyInTxt = units.filter(u => !xlsxUnitIds.has(u.id));
  const onlyInXlsx = xlsxUnits.filter(u => !txtUnitIds.has(u.id));
  const both = units.filter(u => xlsxUnitIds.has(u.id));

  console.log(`Only in CATALOGO.txt: ${onlyInTxt.length}`);
  console.log(`Only in Excel: ${onlyInXlsx.length}`);
  console.log(`In both: ${both.length}`);

  if (onlyInTxt.length > 0) {
    console.log('Only in CATALOGO.txt units:', JSON.stringify(onlyInTxt));
  }
  if (onlyInXlsx.length > 0) {
    console.log('Only in Excel units:', JSON.stringify(onlyInXlsx));
  }
}

main().catch(console.error);
