export const PLUGIN_OWNED_FIELD_NAMES = ['from', 'to', 'StatusCode', 'enabled', 'origin'] as const

export type PluginOwnedFieldName = (typeof PLUGIN_OWNED_FIELD_NAMES)[number]
