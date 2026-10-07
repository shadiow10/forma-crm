// node client/src/lib/sheet.check.mjs — checks the CSV parser and the column mapping of the student import.
import assert from "node:assert/strict";
import { parseCSV, studentsFromSheet } from "./sheet.ts";

assert.deepEqual(parseCSV('a;"b;c";"d ""e"""\r\n1;2;3'), [["a", "b;c", 'd "e"'], ["1", "2", "3"]]);
assert.deepEqual(parseCSV("x,y\n1,2\n"), [["x", "y"], ["1", "2"]]);

const sheet = [
  ["Prénom", "Nom", "Téléphone portable", "E-mail", "Date de naissance"],
  ["Lina", "Haddad", "555123456", "lina@x.dz", "15/03/2004"],
  ["Yacine", "Merabet", "0661 22 33 44", "", "37000"],
  ["", "", "0770000000", "", ""],
  ["Sara", "Belkacem", "0555123456", "", ""], // same phone as Lina once the 0 is restored
  ["Karim", "Ouali", "0699999999", "", ""],   // already in the school
];
const result = studentsFromSheet(sheet, ["0699 99 99 99"]);
assert.equal(result.students.length, 2);
assert.deepEqual(result.students[0], { full_name: "Lina Haddad", phone: "0555123456", email: "lina@x.dz", address: null, dob: "2004-03-15" });
assert.equal(result.students[1].dob, "2001-04-19");
assert.equal(result.incomplete, 1);
assert.equal(result.duplicates, 2);

// No header: name, phone, email in that order.
assert.deepEqual(studentsFromSheet([["Nour Saad", "0550000001", "n@x.dz"]], []).students[0].email, "n@x.dz");
console.log("sheet ok");
