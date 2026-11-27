export class ApiHttpError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, message: string, code: string = 'api_error') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}
