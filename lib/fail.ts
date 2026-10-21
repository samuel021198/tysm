export class Fail extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.name = "Fail";
    this.code = code;
  }
}

export function asFail(error: unknown): string | null {
  return error instanceof Fail ? error.code : null;
}
