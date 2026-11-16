import { HttpErrorResponse } from '@angular/common/http';

/** Turns any HTTP error into a short message that can be shown to the user. */
export function errorMessage(err: unknown): string {
  const e = err as HttpErrorResponse;
  if (e?.status === 0) {
    return 'Cannot reach the server. Is the Spring Boot backend running on port 8080?';
  }
  const body = e?.error as { message?: string; fieldErrors?: Record<string, string> } | null;
  if (body && typeof body === 'object' && body.fieldErrors) {
    const messages = Object.values(body.fieldErrors);
    if (messages.length > 0) {
      return messages.join('. ');
    }
  }
  return body && typeof body === 'object' && body.message ? body.message : 'Something went wrong. Please try again';
}

/** Saves a Blob (file download response) to the user's computer. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return bytes + ' B';
  }
  if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(1) + ' KB';
  }
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
