"use client";

import { loader } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { FDM_THEME } from "./monaco-setup";

/** Charge Monaco depuis les assets locaux (aucun CDN, compatible Pterodactyl). */
loader.config({ paths: { vs: "/monaco/vs" } });

const FIVEM_SNIPPETS = [
  {
    label: "RegisterCommand",
    insertText:
      "RegisterCommand('${1:command}', function(source, args, rawCommand)\n\t${2:-- logique }\nend, ${3:false})",
    documentation: "Enregistre une commande cote serveur.",
  },
  {
    label: "RegisterNetEvent",
    insertText:
      "RegisterNetEvent('${1:eventName}', function(${2:data})\n\t${3:-- logique }\nend)",
    documentation: "Enregistre un evenement reseau.",
  },
  {
    label: "TriggerClientEvent",
    insertText: "TriggerClientEvent('${1:eventName}', ${2:source}, ${3:data})",
    documentation: "Declenche un evenement cote client.",
  },
  {
    label: "TriggerServerEvent",
    insertText: "TriggerServerEvent('${1:eventName}', ${2:data})",
    documentation: "Declenche un evenement cote serveur.",
  },
  {
    label: "CreateVehicle",
    insertText:
      "local ${1:vehicle} = CreateVehicle(GetHashKey('${2:model}'), ${3:x}, ${4:y}, ${5:z}, ${6:heading}, true, true)",
    documentation: "Cree un vehicule cote client.",
  },
  {
    label: "GetPlayerPed",
    insertText: "local ${1:ped} = GetPlayerPed(${2:source})",
    documentation: "Recupere le ped d'un joueur.",
  },
  {
    label: "AddEventHandler",
    insertText: "AddEventHandler('${1:eventName}', function(${2:data})\n\t${3}\nend)",
    documentation: "Ajoute un handler d'evenement.",
  },
  {
    label: "MySQL.query",
    insertText: "MySQL.query.await('${1:SELECT * FROM table WHERE id = ?}', { ${2:id} })",
    documentation: "Requete SQL oxmysql.",
  },
  {
    label: "CreateThread",
    insertText: "CreateThread(function()\n\twhile true do\n\t\tWait(${1:0})\n\t\t${2}\n\tend\nend)",
    documentation: "Boucle de thread FiveM.",
  },
  {
    label: "Server Callback",
    insertText:
      "lib.callback.register('${1:callbackName}', function(source, ${2:data})\n\t${3:-- logique }\nend)",
    documentation: "Callback ox_lib cote serveur.",
  },
];

export function defineThemeAndSnippets(monaco: typeof Monaco): void {
  monaco.editor.defineTheme(FDM_THEME, {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6b7a90", fontStyle: "italic" },
      { token: "keyword", foreground: "a6aef9" },
      { token: "string", foreground: "7ee0b8" },
      { token: "number", foreground: "f5b97f" },
      { token: "type", foreground: "8fd3ff" },
    ],
    colors: {
      "editor.background": "#0d1117",
      "editor.foreground": "#e6edf3",
      "editorLineNumber.foreground": "#3b4657",
      "editorLineNumber.activeForeground": "#94a3b8",
      "editor.selectionBackground": "#5865f244",
      "editor.lineHighlightBackground": "#151b2655",
      "editorCursor.foreground": "#8189f6",
      "editorIndentGuide.background1": "#1f2633",
      "editorWidget.background": "#151b26",
      "editorWidget.border": "#252d3b",
      "editorSuggestWidget.background": "#151b26",
      "editorSuggestWidget.selectedBackground": "#242c3d",
    },
  });

  const languages: Array<[string, string[]]> = [
    ["lua", [".lua", ".fxmanifest"]],
    ["javascript", [".js"]],
    ["typescript", [".ts"]],
    ["json", [".json"]],
    ["sql", [".sql"]],
    ["html", [".html"]],
    ["css", [".css"]],
    ["yaml", [".yml", ".yaml"]],
    ["markdown", [".md"]],
    ["xml", [".xml"]],
    ["ini", [".cfg"]],
  ];

  for (const [language] of languages) {
    const id = `fdm-snippets-${language}`;
    const registered = (monaco.languages as unknown as { __fdmSnippets?: Set<string> }).__fdmSnippets;
    const set = registered ?? new Set<string>();
    (monaco.languages as unknown as { __fdmSnippets?: Set<string> }).__fdmSnippets = set;
    if (set.has(id)) continue;
    set.add(id);

    monaco.languages.registerCompletionItemProvider(language, {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };
        const suggestions = FIVEM_SNIPPETS.map((snippet) => ({
          label: snippet.label,
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: snippet.documentation,
          insertText: snippet.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        }));
        return { suggestions };
      },
    });
  }
}
