/** One platform-stored document: its file name, the field that holds it and a short summary. */
export interface PlatformDocumentField<F> {
  name: string;
  key: keyof F & string;
  summary: string;
}
