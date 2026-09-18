/** Stable API error. `message` is the code only — never a secret or key. */
export class EntitlementError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number) {
    super(code);
    this.name = "EntitlementError";
    this.code = code;
    this.status = status;
  }
}
