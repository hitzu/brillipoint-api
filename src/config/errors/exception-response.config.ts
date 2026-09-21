enum ErrorMessages {
  SIGNUP_EMAIL_IN_USE = 'SIGNUP_EMAIL_IN_USE',
  LOGIN_BAD_CREDENTIAL = 'LOGIN_BAD_CREDENTIAL',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  WRONG_OTP = 'WRONG_OTP',
  AUTHORIZATION_REQUIRED = 'AUTHORIZATION_REQUIRED',
  EMAIL_IS_NOT_VERIFIED = 'EMAIL_IS_NOT_VERIFIED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  BAD_TOKEN_FORMAT = 'BAD_TOKEN_FORMAT',
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  ALREADY_VERIFIED_EMAIL = 'ALREADY_VERIFIED_EMAIL',
  ACCESS_DENIED = 'ACCESS_DENIED',
  GENERATE_TOKEN_ERROR = 'GENERATE_TOKEN_ERROR',
  JWT_SECRET_NOT_FOUND = 'JWT_SECRET_NOT_FOUND',
  PRODUCT_NOT_FOUND = 'PRODUCT_NOT_FOUND',
  PACKAGE_NOT_FOUND = 'PACKAGE_NOT_FOUND',
  EXTRA_NOT_FOUND = 'EXTRA_NOT_FOUND',
  PACKAGE_ID_REQUIRED = 'PACKAGE_ID_REQUIRED',
  BRAND_ID_REQUIRED = 'BRAND_ID_REQUIRED',
  TERM_NOT_FOUND = 'TERM_NOT_FOUND',
  PACKAGE_TERM_NOT_FOUND = 'PACKAGE_TERM_NOT_FOUND',
  BRAND_TERM_NOT_FOUND = 'BRAND_TERM_NOT_FOUND',
  TERM_CODE_ALREADY_EXISTS = 'TERM_CODE_ALREADY_EXISTS',
  BRAND_NOT_FOUND = 'BRAND_NOT_FOUND',
  SLOT_NOT_FOUND = 'SLOT_NOT_FOUND',
  SLOT_NOT_AVAILABLE = 'SLOT_NOT_AVAILABLE',
  SLOT_ALREADY_BOOKED = 'SLOT_ALREADY_BOOKED',
  INVALID_PERIOD = 'INVALID_PERIOD',
  PRODUCT_CREATE_ERROR = 'PRODUCT_CREATE_ERROR',
  SLOT_ALREADY_USED = 'SLOT_ALREADY_USED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  SUPABASE_STORAGE_NOT_CONFIGURED = 'SUPABASE_STORAGE_NOT_CONFIGURED',
  EVENT_NOT_FOUND = 'EVENT_NOT_FOUND',
  EVENT_KEY_ALREADY_EXISTS = 'EVENT_KEY_ALREADY_EXISTS',
  EVENT_CONTRACT_ALREADY_HAS_EVENT = 'EVENT_CONTRACT_ALREADY_HAS_EVENT',
  ENDPOINT_NOT_FOUND = 'ENDPOINT_NOT_FOUND',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_ALREADY_EXISTS = 'SESSION_ALREADY_EXISTS',
  EVENT_EXPIRED = 'EVENT_EXPIRED',
  REQUIRED_SOURCE = 'REQUIRED_SOURCE',
  SESSION_ID_REQUIRED = 'SESSION_ID_REQUIRED',
  BOOKING_NOT_FOUND = 'BOOKING_NOT_FOUND',
}

export const EXCEPTION_RESPONSE: Record<
  ErrorMessages,
  { code: number; message: string }
> = {
  [ErrorMessages.SIGNUP_EMAIL_IN_USE]: {
    code: 1,
    message: 'account with this email exists',
  },
  [ErrorMessages.LOGIN_BAD_CREDENTIAL]: {
    code: 2,
    message: 'email or password is wrong',
  },
  [ErrorMessages.USER_NOT_FOUND]: {
    code: 3,
    message: 'user not found',
  },

  [ErrorMessages.WRONG_OTP]: {
    code: 4,
    message: 'OTP is not correct',
  },
  [ErrorMessages.AUTHORIZATION_REQUIRED]: {
    code: 6,
    message: 'login needed',
  },
  [ErrorMessages.EMAIL_IS_NOT_VERIFIED]: {
    code: 7,
    message: 'email verification needed',
  },
  [ErrorMessages.TOKEN_EXPIRED]: {
    code: 8,
    message: 'session expired',
  },
  [ErrorMessages.INVALID_TOKEN]: {
    code: 9,
    message: 'invalid token',
  },
  [ErrorMessages.BAD_TOKEN_FORMAT]: {
    code: 10,
    message: 'token format is invalid',
  },
  [ErrorMessages.AUTHORIZATION_FAILED]: {
    code: 11,
    message: 'authorization failed',
  },
  [ErrorMessages.ALREADY_VERIFIED_EMAIL]: {
    code: 12,
    message: 'email is already verified',
  },
  [ErrorMessages.ACCESS_DENIED]: {
    code: 13,
    message: 'access denied',
  },
  [ErrorMessages.GENERATE_TOKEN_ERROR]: {
    code: 14,
    message: 'error generating token',
  },
  [ErrorMessages.JWT_SECRET_NOT_FOUND]: {
    code: 15,
    message: 'JWT_SECRET is not found',
  },
  [ErrorMessages.PRODUCT_NOT_FOUND]: {
    code: 16,
    message: 'product not found',
  },
  [ErrorMessages.PACKAGE_NOT_FOUND]: {
    code: 17,
    message: 'package not found',
  },
  [ErrorMessages.EXTRA_NOT_FOUND]: {
    code: 41,
    message: 'extra not found',
  },
  [ErrorMessages.PACKAGE_ID_REQUIRED]: {
    code: 28,
    message: 'packageId is required when scope is package',
  },
  [ErrorMessages.BRAND_ID_REQUIRED]: {
    code: 39,
    message: 'brandId is required when scope is brand',
  },
  [ErrorMessages.TERM_NOT_FOUND]: {
    code: 18,
    message: 'term not found',
  },
  [ErrorMessages.PACKAGE_TERM_NOT_FOUND]: {
    code: 19,
    message: 'package term association not found',
  },
  [ErrorMessages.BRAND_TERM_NOT_FOUND]: {
    code: 40,
    message: 'brand term association not found',
  },
  [ErrorMessages.TERM_CODE_ALREADY_EXISTS]: {
    code: 20,
    message: 'term code already exists',
  },
  [ErrorMessages.BRAND_NOT_FOUND]: {
    code: 21,
    message: 'brand not found',
  },
  [ErrorMessages.SLOT_NOT_FOUND]: {
    code: 22,
    message: 'slot not found',
  },
  [ErrorMessages.SLOT_NOT_AVAILABLE]: {
    code: 23,
    message: 'slot not available for that date/period',
  },
  [ErrorMessages.SLOT_ALREADY_BOOKED]: {
    code: 24,
    message: 'slot is already booked with another contract',
  },
  [ErrorMessages.INVALID_PERIOD]: {
    code: 25,
    message: 'invalid period',
  },
  [ErrorMessages.PRODUCT_CREATE_ERROR]: {
    code: 26,
    message: 'error creating product',
  },
  [ErrorMessages.SLOT_ALREADY_USED]: {
    code: 27,
    message: 'slot is already used by another contract',
  },
  [ErrorMessages.INVALID_CREDENTIALS]: {
    code: 29,
    message: 'invalid credentials',
  },
  [ErrorMessages.SUPABASE_STORAGE_NOT_CONFIGURED]: {
    code: 30,
    message: 'supabase storage is not configured',
  },
  [ErrorMessages.EVENT_NOT_FOUND]: {
    code: 31,
    message: 'event not found',
  },
  [ErrorMessages.EVENT_KEY_ALREADY_EXISTS]: {
    code: 32,
    message: 'event key already exists',
  },
  [ErrorMessages.EVENT_CONTRACT_ALREADY_HAS_EVENT]: {
    code: 34,
    message: 'this contract already has an event',
  },
  [ErrorMessages.ENDPOINT_NOT_FOUND]: {
    code: 33,
    message: 'endpoint not found',
  },
  [ErrorMessages.SESSION_NOT_FOUND]: {
    code: 35,
    message: 'session not found',
  },
  [ErrorMessages.SESSION_ALREADY_EXISTS]: {
    code: 36,
    message: 'session already exists',
  },
  [ErrorMessages.EVENT_EXPIRED]: {
    code: 37,
    message: 'event has expired',
  },
  [ErrorMessages.REQUIRED_SOURCE]: {
    code: 38,
    message: 'source is required for gallery_opened and session_opened',
  },
  [ErrorMessages.SESSION_ID_REQUIRED]: {
    code: 38,
    message: 'sessionId is required for this event',
  },
  [ErrorMessages.BOOKING_NOT_FOUND]: {
    code: 42,
    message: 'booking not found',
  },
};
