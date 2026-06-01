/**
 * Single source of truth for Xray language keywords, built-in functions, types,
 * and literals.  Imported by the Markdown highlighter, inline-values provider,
 * and any other component that needs to classify identifiers.
 *
 * Keep in sync with core lexer keywords, contextual parser words, and
 * analyzer-registered built-in symbols in the xray core repo.
 */

// ---------------------------------------------------------------------------
// Keywords — reserved words and parser-contextual words.
// ---------------------------------------------------------------------------

export const KEYWORDS = new Set([
    // Declarations
    'let', 'const', 'fn', 'class', 'struct', 'interface', 'enum', 'type',
    // Primitive type keywords
    'int', 'int8', 'int16', 'int32', 'int64',
    'uint8', 'uint16', 'uint32', 'uint64',
    'float', 'float32', 'float64', 'string', 'bool', 'unknown',
    // Control flow
    'if', 'else', 'while', 'for', 'in', 'is', 'break', 'continue',
    'return', 'yield', 'match',
    // Class / OOP
    'extends', 'implements', 'constructor', 'this', 'super',
    'new', 'static', 'private', 'public', 'abstract', 'override', 'final',
    'operator',
    // Error handling
    'try', 'catch', 'throw', 'panic',
    // Module system
    'import', 'export', 'from', 'as',
    // Concurrency
    'go', 'await', 'select', 'defer', 'scope', 'linked', 'supervisor', 'after',
    'cancelled', 'shared',
    // Contextual
    'ref', 'move', 'to',
    // Literals that look like keywords
    'true', 'false', 'null',
]);

// ---------------------------------------------------------------------------
// Built-in global functions (callable without import).
// ---------------------------------------------------------------------------

export const BUILTIN_FUNCTIONS = new Set([
    'print', 'dump', 'typeof',
    'assert', 'assert_eq', 'assert_ne', 'assert_true', 'assert_false',
    'assert_throws',
    'int', 'float', 'string', 'bool',
    'copy', 'chr',
]);

// ---------------------------------------------------------------------------
// Literal constants (subset of keywords used for literal-specific colouring).
// ---------------------------------------------------------------------------

export const LITERALS = new Set(['true', 'false', 'null']);

// ---------------------------------------------------------------------------
// Built-in type names (container types, utility types).
// ---------------------------------------------------------------------------

export const BUILTIN_TYPES = new Set([
    'Array', 'Map', 'Set', 'Json', 'Bytes', 'Channel', 'BigInt',
    'Range', 'StringBuilder', 'Regex', 'DateTime',
    'Logger', 'NetConn', 'NetListener', 'Task', 'WeakMap', 'WeakSet', 'Result',
    'Atomic', 'Ordering',
]);

// ---------------------------------------------------------------------------
// Primitive type names.
// ---------------------------------------------------------------------------

export const PRIMITIVE_TYPES = new Set([
    'int', 'int8', 'int16', 'int32', 'int64',
    'uint8', 'uint16', 'uint32', 'uint64',
    'float', 'float32', 'float64',
    'string', 'bool', 'unknown',
]);
