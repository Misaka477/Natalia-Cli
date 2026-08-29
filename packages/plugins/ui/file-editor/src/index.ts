import type { Component } from "solid-js";

export { FileEditor, default } from "./file-editor";
export { createFileEditorPlugin } from "./plugin.tsx";
export type FileEditorComponent = Component;
export const FILE_EDITOR_PLUGIN_ID = "natalia.ui.file-editor";
