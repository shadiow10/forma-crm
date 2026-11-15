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
  ["Lina", "Haddad", "0555123456", "", ""],   // the same person twice once the 0 is restored
  ["Sara", "Haddad", "0555123456", "", ""],   // her sister, same family number: kept
  ["Karim", "Ouali", "0699999999", "", ""],   // already in the school
];
const result = studentsFromSheet(sheet, [{ full_name: "Karim  Ouali", phone: "0699 99 99 99" }]);
assert.equal(result.students.length, 3);
// Separate Nom / Prénom columns are kept (0032), and the full name reads "NOM Prénom" like the form.
assert.deepEqual(result.students[0], { full_name: "Haddad Lina", last_name: "Haddad", first_name: "Lina", phone: "0555123456", email: "lina@x.dz", address: null, dob: "2004-03-15", level: null, parent_phone: null });
assert.equal(result.students[1].dob, "2001-04-19");
assert.equal(result.students[2].full_name, "Haddad Sara");
assert.equal(result.incomplete, 1);
assert.equal(result.duplicates, 2);

// École de soutien: the parent's number is not the pupil's, and stands in for it when the pupil has none.
const pupils = studentsFromSheet([
  ["Nom complet", "Téléphone parent", "Téléphone", "Niveau"],
  ["Amine Saadi", "0550112233", "", "3 AS"],
  ["Rym Saadi", "0550112233", "0770445566", "4ème AM"],
], []).students;
assert.deepEqual(pupils.map((pupil) => [pupil.phone, pupil.parent_phone, pupil.level]), [["0550112233", "0550112233", "3AS"], ["0770445566", "0550112233", "4AM"]]);

// No header: name, phone, email in that order.
assert.deepEqual(studentsFromSheet([["Nour Saad", "0550000001", "n@x.dz"]], []).students[0].email, "n@x.dz");
console.log("sheet ok");
