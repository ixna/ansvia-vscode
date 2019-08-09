
import { window, workspace, ExtensionContext, commands, Uri, WorkspaceEdit, TextEdit } from 'vscode';
import { getRootDir, ProjectType, getFlutterInfo, FlutterInfo } from './util';
import { doGenerateBlocCode, BlocOpts } from './bloc';
import { Cmd } from './cmd';

var snakeCase = require('snake-case');
var camelCase = require('camel-case');
var pascalCase = require('pascal-case');

var fs = require('fs');

export enum PageKind {
  Basic,
  Detail
}

export class GenPageOpts {
  kind: PageKind;
  constructor(kind: PageKind) {
    this.kind = kind;
  }
}

export async function generatePage(opts: GenPageOpts) {
  const flutter = getFlutterInfo();

  if (!flutter) {
    return;
  }

  // get component name
  const name = await window.showInputBox({
    value: '',
    valueSelection: [0, 11],
    placeHolder: 'Name, eg: Todo'
  }) || "";

  var libDir = `${flutter.projectDir}/lib`;
  var screenDir = `${libDir}/screens`;

  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir);
    if (!fs.existsSync(screenDir)) {
      fs.mkdirSync(screenDir);
    }
  }
  var nameSnake = snakeCase(name);

  var pageNameDir = nameSnake.split('_')[0];

  if (!fs.existsSync(`${screenDir}/${pageNameDir}`)) {
    fs.mkdirSync(`${screenDir}/${pageNameDir}`);
  }

  var pageFilePath = "";
  switch (opts.kind) {
    case PageKind.Detail:
      pageFilePath = `${screenDir}/${pageNameDir}/${nameSnake}_detail_page.dart`;
      break;
    case PageKind.Basic:
      pageFilePath = `${screenDir}/${pageNameDir}/${nameSnake}_page.dart`;
      break;
  }

  // var pageFile = `${screenDir}/${nameSnake}/${nameSnake}_page.dart`;
  // var pageFile = `${screenDir}/${nameSnake}_page.dart`;

  if (fs.existsSync(pageFilePath)) {
    window.showWarningMessage(`File already exists: ${pageFilePath}`);
  } else {
    switch (opts.kind) {
      case PageKind.Basic:
        fs.writeFileSync(pageFilePath, _genCode(name, flutter, opts));
        break;
      case PageKind.Detail:
        fs.writeFileSync(pageFilePath, await _genCodeDetail(name, flutter, opts));
        break;
    }
    const fileUri = Uri.file(pageFilePath);

    // commands.executeCommand("vscode.executeFormatDocumentProvider", fileUri,
    //   { tabSize: 2, insertSpaces: true, insertFinalNewline: true })
    //   .then((edits) => {
    //     if (edits !== undefined) {
    //       let formatEdit = new WorkspaceEdit();
    //       formatEdit.set(fileUri, edits as TextEdit[]);
    //       workspace.applyEdit(formatEdit);
    //       workspace.saveAll();
    //     }
    //   },
    //     (error) => console.error(error));
  }
}

async function _genCodeDetail(name: String, flutter: FlutterInfo, opts: GenPageOpts) {
  const projectNameSnake = snakeCase(flutter.projectName);
  const nameSnake = snakeCase(name);
  const namePascal = pascalCase(name);

  const attrs = await window.showInputBox({
    value: '',
    valueSelection: [0, 11],
    placeHolder: 'Attributes to show, eg: name,active'
  }) || "";

  var attrsLines = [];

  for (let _att of attrs.split(',')) {
    let att = _att.trim();
    attrsLines.push(`DetailField("${pascalCase(att)}:", item.${camelCase(att)}),`);
  }
  const rowsAdd = attrsLines.join(',\n                    ');

  var newLines = [];

  newLines.push(`
import 'package:flutter/material.dart';
import 'package:flutter/widgets.dart';
import 'package:${projectNameSnake}_mobile/models/${nameSnake}.dart';

class ${namePascal}DetailPage extends StatefulWidget {
  final ${namePascal} item;

  ${namePascal}DetailPage({Key key, @required this.item}) : super(key: key);

  _${namePascal}DetailPageState createState() => _${namePascal}DetailPageState(this.item);
}

class _${namePascal}DetailPageState extends State<${namePascal}DetailPage> {
  final ${namePascal} item;

  _${namePascal}DetailPageState(this.item);

  @override
  Widget build(BuildContext context) {
    return Container(
      child: _getBody(context),
    );
  }

  Widget _getBody(BuildContext context) {
    return Center(
      child: ListView(
        children: <Widget>[
          Padding(
              padding: const EdgeInsets.all(10.0),
              child: Column(
                children: <Widget>[
                  ${rowsAdd}
                ],
              )),
        ],
      ),
    );
  }
}
  `.trim());

  return newLines.join('\n');

}

function _genCode(name: String, flutter: FlutterInfo, opts: GenPageOpts) {
  const nameSnake = snakeCase(name);
  const namePascal = pascalCase(name);

  return `
  import 'package:flutter/material.dart';
  
  class ${namePascal}Page extends StatefulWidget {
    ${namePascal}Page({Key key}) : super(key: key);
  
    @override
    State<${namePascal}Page> createState() => _${namePascal}State();
  }
  
  class _${namePascal}State extends State<${namePascal}Page> {
    final _nameController = TextEditingController();
  
    @override
    Widget build(BuildContext context) {
      final bloc = BlocProvider.of<${namePascal}Bloc>(context);
  
      _onAddButtonPressed() {
        bloc.dispatch(${namePascal}(_nameController.text, _codeController.text,
            int.parse(_gradeController.text)));
      }
  
      return Scaffold(
        appBar: AppBar(title: Text("Add new Project")),
        body: BlocListener<${namePascal}Bloc, ${namePascal}State>(
            listener: (context, state) {
          if (state is ProjectCreated) {
            Navigator.pop(context);
          } else if (state is ${namePascal}Failure) {
            Scaffold.of(context).showSnackBar(SnackBar(
              content: Text(
                state.error,
                style: TextStyle(color: Colors.white),
              ),
              backgroundColor: Colors.red,
              duration: Duration(seconds: 3),
            ));
          }
        }, child: BlocBuilder<${namePascal}Bloc, ${namePascal}State>(
          builder: (context, state) {
            print("project_add_page.state = $state");
            return Center(
              child: ListView(
                children: <Widget>[
                  Padding(
                      padding: const EdgeInsets.all(10.0),
                      child: Form(
                          child: Column(
                        children: <Widget>[
                          TextFormField(
                            decoration:
                                InputDecoration(labelText: "Project name"),
                            controller: _nameController,
                          ),
                          TextFormField(
                            decoration: InputDecoration(labelText: "Code"),
                            controller: _codeController,
                          ),
                          TextFormField(
                            decoration: InputDecoration(labelText: "Grade"),
                            controller: _gradeController,
                          ),
                          Row(
                            children: <Widget>[
                              RaisedButton(
                                onPressed: state is! ${namePascal}Loading
                                    ? _onAddButtonPressed
                                    : null,
                                child: Text("Add"),
                              )
                            ],
                          )
                        ],
                      ))),
                ],
              ),
            );
          },
        )),
      );
    }
  }
  `;
}