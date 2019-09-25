import { workspace, TextDocument, window } from "vscode";

import fs = require('fs');
import camelCase = require("camel-case");
import config = require('./config');


export function setupSyncGen() {
  const rootDir = workspace.workspaceFolders![0].uri.path;

  if (!rootDir) {
    return;
  }

  // var config = yaml.safeLoad(fs.readFileSync(`${rootDir}/ansvia-vscode.yaml`));
  let conf = config.parse();
  console.log(conf);

  if (!conf){
    return;
  }

  var sync_gen = conf['sync_gen'];

  if (sync_gen) {
    const c = sync_gen['error_code'];

    workspace.onDidSaveTextDocument((document: TextDocument) => {
      // extension.runCommands(document);
      console.log(`document saved: ${document.fileName}`);
      if (document.fileName === `${rootDir}/${c['src']}`) {
        genErrorCodeFromRust(rootDir, c['src'], c['outs']);
      }
    });
  }
  
}

function genErrorCodeFromRust(rootDir: String, source: String, outs: Array<String>) {
  console.log("Generating error codes...");

  let reName = new RegExp('^(pub)? ?enum ErrorCode ?{?$');
  let reDec = new RegExp('(\\w*) ?= ?(\\d*),?');

  let lines = fs.readFileSync(`${rootDir}/${source}`, 'utf8').split('\n');
  var inErrorCode = false;
  var headerLines: Array<string> = [];
  var jsLines = [];
  var dartLines = [];

  headerLines.push('// This file is autogenerated by ansvia-vscode');
  headerLines.push('// don\'t edit by hand or your changes will lost without you knowing');

  jsLines.push(`export default class ErrorCode {`);
  dartLines.push(`class ErrorCode {`);

  for (let line of lines) {
    let linet = line.trim();

    // console.log('reName.test(' + linet + '): ' + reName.test(linet));

    if (!inErrorCode && reName.test(linet)) {
      inErrorCode = true;
    }
    if (inErrorCode) {
      if (linet.startsWith('///')) {
        jsLines.push('  ' + linet.substring(1));
        dartLines.push('  ' + linet.substring(1));
      } else {
        let s = reDec.exec(linet);
        if (s && s.length === 3) {
          jsLines.push(`  static ${s[1]} = ${s[2]};`);
          dartLines.push(`  static const int ${camelCase(s[1])} = ${s[2]};`);
        }
      }
      if (linet === '}') {
        break;
      }
    }
  }

  jsLines.push('}');
  dartLines.push('}');

  let jsCode = headerLines.join('\n') + '\n' + jsLines.join('\n');
  let dartCode = headerLines.join('\n') + '\n' + dartLines.join('\n');

  outs.forEach((fpath) => {
    if (fpath.startsWith('js:')) {
      let path = fpath.substring(3);
      console.log("syncing error code to " + path + " ...");
      let outPath = `${rootDir}/${path}`;
      fs.writeFileSync(outPath, jsCode);
    }
    if (fpath.startsWith('dart:')) {
      let path = fpath.substring(5);
      console.log("syncing error code to " + path + " ...");
      let outPath = `${rootDir}/${path}`;
      fs.writeFileSync(outPath, dartCode);
    }
  });
}
