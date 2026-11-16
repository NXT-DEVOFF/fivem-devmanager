"use client";

import Editor, { DiffEditor, type OnMount } from "@monaco-editor/react";
import { FDM_THEME } from "./monaco-setup";
import { defineThemeAndSnippets } from "./monaco-runtime";

export function MonacoEditorPane({
  diffMode,
  path,
  language,
  original,
  value,
  onChange,
  onMount,
}: {
  diffMode: boolean;
  path: string;
  language: string;
  original: string;
  value: string;
  onChange: (value: string) => void;
  onMount: OnMount;
}) {
  if (diffMode) {
    return (
      <DiffEditor
        height="100%"
        theme={FDM_THEME}
        language={language}
        original={original}
        modified={value}
        beforeMount={defineThemeAndSnippets}
        options={{ readOnly: false, renderSideBySide: true, fontSize: 13, minimap: { enabled: false } }}
      />
    );
  }

  return (
    <Editor
      height="100%"
      path={path}
      language={language}
      theme={FDM_THEME}
      value={value}
      beforeMount={defineThemeAndSnippets}
      onMount={onMount}
      onChange={(next) => onChange(next ?? "")}
      options={{
        fontSize: 13,
        minimap: { enabled: true, renderCharacters: false, maxColumn: 80 },
        smoothScrolling: true,
        cursorBlinking: "smooth",
        scrollBeyondLastLine: false,
        tabSize: 2,
        automaticLayout: true,
        wordWrap: "off",
        renderWhitespace: "selection",
        bracketPairColorization: { enabled: true },
      }}
    />
  );
}
