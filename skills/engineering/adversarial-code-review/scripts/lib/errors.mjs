export class ReviewError extends Error {
  constructor(message, { exitCode = 1, kind = "runtime-error", detail = null } = {}) {
    super(message);
    this.name = "ReviewError";
    this.exitCode = exitCode;
    this.kind = kind;
    this.detail = detail;
  }
}

export function asReviewError(error) {
  if (error instanceof ReviewError) return error;
  return new ReviewError(error instanceof Error ? error.message : String(error));
}

