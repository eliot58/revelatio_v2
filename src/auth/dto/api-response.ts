export class ApiResponse<T> {
    status: 'ok';
    code: string;
    message: string;
    data?: T;
    meta?: Record<string, unknown>;
  }
  