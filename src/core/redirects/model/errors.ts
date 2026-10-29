export class RedirectConfigError extends Error {
  readonly name = 'RedirectConfigError'
}

export class RedirectValidationError extends Error {
  readonly name = 'RedirectValidationError'
}

export class RedirectAmbiguousRuleError extends Error {
  readonly name = 'RedirectAmbiguousRuleError'
}
