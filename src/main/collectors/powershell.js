'use strict';
// Ejecuta PowerShell sin líos de comillas (script en base64 UTF-16LE con -EncodedCommand)
// y fuerza la salida en UTF-8 para que tildes y eñes no se rompan.
const { execFile, spawn } = require('node:child_process');

const PS_ARGS = ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand'];
const PREAMBLE =
  "$ProgressPreference='SilentlyContinue'; $ErrorActionPreference='SilentlyContinue'; " +
  '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;\n';

const encode = (script) => Buffer.from(PREAMBLE + script, 'utf16le').toString('base64');
const stripBom = (s) => s.replace(/^﻿/, '').trim();

// Ejecuta un script que imprime UN JSON por stdout y lo devuelve ya parseado.
function runJson(script, { timeoutMs = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      [...PS_ARGS, encode(script)],
      { windowsHide: true, timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024, encoding: 'utf8' },
      (err, stdout, stderr) => {
        const out = stripBom(stdout || '');
        if (err && !out) return reject(err);
        try {
          resolve(JSON.parse(out));
        } catch (e) {
          reject(new Error('PowerShell no devolvió JSON válido: ' + stripBom(stderr || e.message).slice(0, 300)));
        }
      }
    );
  });
}

// Lanza un script que imprime una línea JSON por tick; llama a onLine con cada línea.
// Devuelve una función para pararlo.
function streamLines(script, onLine, onExit) {
  const child = spawn('powershell.exe', [...PS_ARGS, encode(script)], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  let buf = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = stripBom(buf.slice(0, i));
      buf = buf.slice(i + 1);
      if (line) onLine(line);
    }
  });
  child.on('exit', (code) => onExit && onExit(code));
  child.on('error', (err) => onExit && onExit(-1, err));
  return () => {
    try { child.kill(); } catch { /* ya terminó */ }
  };
}

module.exports = { runJson, streamLines, encode };
