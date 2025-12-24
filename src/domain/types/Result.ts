/**
 * Generic Result type for safe error handling
 * Follows functional programming patterns
 */
export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };
