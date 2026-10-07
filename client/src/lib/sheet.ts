// Reads the first sheet of an .xlsx file, or a .csv/.tsv export, as rows of text. No library: an
// .xlsx is a zip of XML files, and the browser already ships the deflate decoder and the XML parser.
// ponytail: no legacy .xls or .ods; Excel and LibreOffice both save as .xlsx or .csv.

async function unzip(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  let end = buffer.byteLength - 22;
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end--;
  if (end < 0) throw new Error("not a zip");
  const entries = new Map<string, () => Promise<string>>();
  let at = view.getUint32(end + 16, true);
  for (let i = view.getUint16(end + 10, true); i > 0; i--) {
    const method = view.getUint16(at + 10, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const local = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(new Uint8Array(buffer, at + 46, nameLength)).replace(/\\/g, "/"); // some Windows zippers write "xl\\..."
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    entries.set(name, async () => {
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      const bytes = new Blob([new Uint8Array(buffer, start, size)]);
      const stream = method === 8 ? bytes.stream().pipeThrough(new DecompressionStream("deflate-raw")) : bytes.stream();
      return new Response(stream).text();
    });
  }
  return entries;
}

const xml = (text: string) => new DOMParser().parseFromString(text, "application/xml");
const tags = (node: Document | Element, name: string) => Array.from(node.getElementsByTagName(name));
const columnIndex = (ref: string) => [...ref.replace(/\d+/g, "")].reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;

async function readXlsx(buffer: ArrayBuffer) {
  const files = await unzip(buffer);
  const read = async (path: string) => xml(await (files.get(path) ?? (() => Promise.resolve("<x/>")))());
  // The first sheet in workbook order, found through the workbook's relationships.
  const firstSheet = tags(await read("xl/workbook.xml"), "sheet")[0];
  const relId = firstSheet?.getAttribute("r:id");
  const target = tags(await read("xl/_rels/workbook.xml.rels"), "Relationship").find((rel) => rel.getAttribute("Id") === relId)?.getAttribute("Target");
  const sheetPath = target ? (target.startsWith("/") ? target.slice(1) : `xl/${target}`) : "xl/worksheets/sheet1.xml";
  const shared = tags(await read("xl/sharedStrings.xml"), "si").map((si) => tags(si, "t").map((t) => t.textContent).join(""));
  return tags(await read(sheetPath), "row").map((row) => {
    const cells: string[] = [];
    for (const cell of tags(row, "c")) {
      const value = tags(cell, "v")[0]?.textContent ?? tags(cell, "t").map((t) => t.textContent).join("");
      cells[columnIndex(cell.getAttribute("r") ?? "A")] = cell.getAttribute("t") === "s" ? shared[Number(value)] ?? "" : value;
    }
    return Array.from(cells, (cell) => cell ?? "");
  });
}

// Quoted fields may hold the separator, quotes ("") and line breaks.
export function parseCSV(text: string) {
  const firstLine = text.slice(0, text.indexOf("\n") >>> 0);
  const separator = ["\t", ";", ","].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === separator) { row.push(field); field = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export async function readSheet(file: File): Promise<string[][]> {
  const buffer = await file.arrayBuffer();
  const rows = new Uint8Array(buffer, 0, 2).join() === "80,75" // "PK": a zip, so .xlsx
    ? await readXlsx(buffer)
    : parseCSV((() => {
      // Excel saves CSV as UTF-8 or as Windows-1252 depending on the version: try the first, fall back.
      const utf8 = new TextDecoder().decode(buffer);
      return (utf8.includes("�") ? new TextDecoder("windows-1252").decode(buffer) : utf8).replace(/^﻿/, "");
    })());
  return rows.map((row) => row.map((cell) => cell.trim())).filter((row) => row.some(Boolean));
}

// ---------------------------------------------------------------- Students from a sheet

export type ImportedStudent = { full_name: string; phone: string; email: string | null; address: string | null; dob: string | null; level: string | null; parent_phone: string | null };

const normalize = (text: string) => text.toLowerCase().normalize("NFD").replace(/[^a-z0-9\u0621-\u064A]/g, "");
const HEADERS = {
  full: ["nomcomplet", "nometprenom", "nomprenom", "prenomnom", "fullname", "name", "etudiant", "eleve", "student", "pupil", "الاسمالكامل", "الاسمواللقب", "اللقبوالاسم"],
  first: ["prenom", "firstname", "الاسم"],
  last: ["nom", "lastname", "surname", "اللقب"],
  // Matched before phone, so "Téléphone parent" is not read as the pupil's own number.
  parent_phone: ["telephoneparent", "telparent", "telephonedesparents", "telephonedupere", "telephonedelamere", "telephonetuteur", "parentphone", "phoneparent", "هاتفالولي", "رقمالولي"],
  phone: ["telephone", "tel", "phone", "mobile", "portable", "numero", "الهاتف", "رقمالهاتف"],
  email: ["email", "mail", "courriel", "adressemail", "البريدالالكتروني", "البريد"],
  address: ["adresse", "address", "العنوان"],
  dob: ["datedenaissance", "naissance", "dob", "birthdate", "dateofbirth", "تاريخالميلاد"],
  level: ["niveau", "classe", "level", "annee", "المستوى", "القسم"],
};
type Column = keyof typeof HEADERS;

// Dates arrive as 2004-03-15, 15/03/2004, or an Excel serial number (days since 1899-12-30).
function toISODate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const dmy = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  if (/^\d{4,5}(\.\d+)?$/.test(value)) return new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(value)) * 86400000).toISOString().slice(0, 10);
  return null;
}
// Excel drops the leading 0 of a mobile number typed as a number: 555123456 → 0555123456.
const toPhone = (value: string) => (/^[567]\d{8}$/.test(value) ? `0${value}` : value);
// "3 AS", "3as", "3ème AS" → "3AS"; anything that is not a school year is left out.
const toLevel = (value: string) => { const match = value.toUpperCase().replace(/\s|ÈME|EME/g, "").match(/^([1-5])A([PMS])$/); return match ? `${match[1]}A${match[2]}` : null; };
// Brothers and sisters share a parent's number: a duplicate is the same name on the same number.
const personKey = (name: string, phone: string) => `${normalize(name)}|${phone.replace(/\D/g, "")}`;

// Maps the header row to columns. Without a recognisable header, the columns are read as name, phone, email.
export function studentsFromSheet(rows: string[][], existing: { full_name: string; phone: string }[]) {
  const header = (rows[0] ?? []).map(normalize);
  const taken = new Set<number>();
  const find = (column: Column) => {
    const index = header.findIndex((cell, i) => !taken.has(i) && HEADERS[column].some((alias) => cell === alias || (alias.length >= 5 && cell.startsWith(alias))));
    if (index >= 0) taken.add(index);
    return index;
  };
  const at = Object.fromEntries((Object.keys(HEADERS) as Column[]).map((column) => [column, find(column)])) as Record<Column, number>;
  const hasHeader = at.full >= 0 || at.last >= 0 || at.phone >= 0 || at.parent_phone >= 0;
  if (!hasHeader) Object.assign(at, { full: 0, first: -1, last: -1, parent_phone: -1, phone: 1, email: 2, address: -1, dob: -1, level: -1 });
  const cell = (row: string[], column: Column) => (at[column] >= 0 ? row[at[column]] ?? "" : "");

  const seen = new Set(existing.map((student) => personKey(student.full_name, student.phone)));
  const students: ImportedStudent[] = [];
  let incomplete = 0, duplicates = 0;
  for (const row of hasHeader ? rows.slice(1) : rows) {
    const full_name = (cell(row, "full") || [cell(row, "first"), cell(row, "last")].filter(Boolean).join(" ")).replace(/\s+/g, " ").trim();
    const parent_phone = toPhone(cell(row, "parent_phone")) || null;
    const phone = toPhone(cell(row, "phone")) || parent_phone || ""; // a pupil without a phone is reached through the parent
    if (!full_name || !phone) { incomplete++; continue; }
    if (seen.has(personKey(full_name, phone))) { duplicates++; continue; }
    seen.add(personKey(full_name, phone));
    students.push({ full_name, phone, email: cell(row, "email") || null, address: cell(row, "address") || null, dob: toISODate(cell(row, "dob")), level: toLevel(cell(row, "level")), parent_phone });
  }
  return { students, incomplete, duplicates };
}
