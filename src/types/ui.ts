export type WriteState =
  | "idle"
  | "saving"
  | "saved"
  | "reconnecting"
  | "offline";

export type EditorMode = "edit" | "formula" | "view";

export interface ToastState {
  message: string;
  tone: "error" | "info" | "success";
}
