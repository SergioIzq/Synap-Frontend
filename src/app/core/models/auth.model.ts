export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  expiresAt: string;
}

export interface ApiTokenStatus {
  hasToken: boolean;
  createdAt: string | null;
}

/** Mirrors the backend's Result/Result<T> shape (see AbsController.HandleResult). */
export interface ApiResult<T = void> {
  isSuccess: boolean;
  isFailure: boolean;
  value: T;
  error?: {
    code: string;
    name: string;
    message: string;
  };
}
