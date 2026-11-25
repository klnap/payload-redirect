export class RedirectConfigError extends Error {
  override readonly name = 'RedirectConfigError'
}

export class RedirectValidationError extends Error {
  override readonly name = 'RedirectValidationError'
}

export class RedirectAmbiguousRuleError extends Error {
  override readonly name = 'RedirectAmbiguousRuleError'
}
