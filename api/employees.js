const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const workbookPath = path.join(
  process.cwd(),
  process.env.EMPLOYEE_DIRECTORY_FILE || 'data/employees.xlsx'
);

function normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findColumn(headers, aliases) {
  return headers.findIndex((header) => aliases.includes(normalize(header)));
}

async function loadEmployees() {
  if (!fs.existsSync(workbookPath)) throw new Error(`Employee workbook not found: ${workbookPath}`);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);
  const employees = [];

  workbook.eachSheet((worksheet) => {
    const headerRow = worksheet.getRow(1);
    const headers = headerRow.values.slice(1);
    const idColumn = findColumn(headers, ['id', 'employeeid', 'employeenumber', 'staffid', 'staffnumber']);
    const firstNameColumn = findColumn(headers, ['name', 'employeename', 'fullname', 'staffname', 'firstname']);
    const lastNameColumn = findColumn(headers, ['lastname', 'surname', 'familyname']);
    const resolvedIdColumn = idColumn >= 0 ? idColumn : 0;
    const resolvedNameColumn = firstNameColumn >= 0 ? firstNameColumn : 1;
    if (resolvedIdColumn >= headers.length || resolvedNameColumn >= headers.length) return;

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const id = String(row.getCell(resolvedIdColumn + 1).text || '').trim();
      const firstName = String(row.getCell(resolvedNameColumn + 1).text || '').trim();
      const lastName = lastNameColumn >= 0
        ? String(row.getCell(lastNameColumn + 1).text || '').trim()
        : resolvedNameColumn === 1 && headers.length > 2
          ? String(row.getCell(3).text || '').trim()
          : '';
      const name = `${firstName} ${lastName}`.trim();
      if (id && name) employees.push({ id, name });
    });
  });
  return employees;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const query = (req.query.q || '').toString().trim().toLowerCase();
  if (query.length < 2) {
    res.status(200).json({ employees: [] });
    return;
  }

  try {
    const matches = (await loadEmployees())
      .filter(({ id, name }) => id.toLowerCase().includes(query) || name.toLowerCase().includes(query))
      .slice(0, 12);
    res.status(200).json({ employees: matches });
  } catch (err) {
    console.error('employees error:', err);
    res.status(500).json({ error: 'Unable to load the employee directory.' });
  }
};