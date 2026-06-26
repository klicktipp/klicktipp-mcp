export class KlickTippApiError extends Error {
  constructor(status, body, message) {
    super(message ?? `KlickTipp API request failed with status ${status}.`);
    this.name = "KlickTippApiError";
    this.status = status;
    this.body = body;
  }
}

export function toStructuredError(error) {
  if (error instanceof KlickTippApiError) {
    return {
      type: error.status === 406 ? "business_validation_error" : "klicktipp_api_error",
      status: error.status,
      message: error.message,
      body: error.body,
    };
  }

  return {
    type: "internal_error",
    message: error?.message ?? String(error),
  };
}
