// node client/src/lib/zip.check.mjs — builds a .zip with zipFiles and has the system unzip it back.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { toCSV, zipFiles } from "./zip.ts";

const files = [
  { name: "etudiants.csv", text: toCSV([["nom", "téléphone"], ["Haddad Lina", "0555123456"], ['Dit "Lili"', null]]) },
  { name: "présences.csv", text: toCSV([["date"], ["2026-11-15"]]) },   // accented name: UTF-8 flag
];
assert.equal(files[0].text, '﻿"nom","téléphone"\r\n"Haddad Lina","0555123456"\r\n"Dit ""Lili""",""');

const dir = mkdtempSync(join(tmpdir(), "zipcheck-"));
writeFileSync(join(dir, "out.zip"), Buffer.from(await zipFiles(files).arrayBuffer()));
const unzip = process.platform === "win32"
  ? ["powershell", ["-NoProfile", "-Command", `Expand-Archive -LiteralPath '${join(dir, "out.zip")}' -DestinationPath '${join(dir, "x")}'`]]
  : ["unzip", ["-q", join(dir, "out.zip"), "-d", join(dir, "x")]];
execFileSync(...unzip);
for (const file of files) assert.equal(readFileSync(join(dir, "x", file.name), "utf8"), file.text, file.name);
console.log("zip ok");
