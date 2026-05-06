/**
 * Single source of truth for Xray language keywords, built-in functions, types,
 * and literals.  Imported by the Markdown highlighter, inline-values provider,
 * and any other component that needs to classify identifiers.
 *
 * Keep in sync with `src/frontend/lexer/xlex.h` in the xray core repo.
 */

// ---------------------------------------------------------------------------
// Keywords — every reserved word recognised by the Xray lexer / parser.
// ---------------------------------------------------------------------------

export const KEYWORDS = new Set([
    // Declarations
    'let', 'const', 'fn', 'class', 'struct', 'interface', 'enum', 'type',
    // Control flow
    'if', 'else', 'while', 'for', 'in', 'is', 'to', 'break', 'continue',
    'return', 'yield', 'match', 'case', 'default',
    // Class / OOP
    'extends', 'implements', 'constructor', 'this', 'base', 'super',
    'new', 'static', 'private', 'public', 'abstract', 'override', 'final',
    'operator',
    // Exception handling
    'try', 'catch', 'finally', 'throw',
    // Module system
    'import', 'export', 'from', 'as',
    // Concurrency
    'go', 'await', 'select', 'defer', 'scope', 'after',
    'cancel', 'cancelled', 'shared',
    // Contextual
    'ref', 'move',
    // Literals that look like keywords
    'true', 'false', 'null',
]);

// ---------------------------------------------------------------------------
// Built-in global functions (callable without import).
// ---------------------------------------------------------------------------

export const BUILTIN_FUNCTIONS = new Set([
    'print', 'println', 'printf', 'sprintf', 'dump',
    'typeof', 'typename', 'nameof',
    'assert', 'assert_eq', 'assert_ne', 'assert_true', 'assert_false',
    'panic', 'copy', 'chr', 'ord', 'len', 'range',
    'min', 'max', 'abs', 'hash',
]);

// ---------------------------------------------------------------------------
// Literal constants (subset of keywords used for literal-specific colouring).
// ---------------------------------------------------------------------------

export const LITERALS = new Set(['true', 'false', 'null']);

// ---------------------------------------------------------------------------
// Built-in type names (container types, utility types).
// ---------------------------------------------------------------------------

export const BUILTIN_TYPES = new Set([
    'Array', 'Map', 'Set', 'Json', 'Bytes', 'Slice', 'Channel', 'BigInt',
    'Range', 'StringBuilder', 'Exception', 'Error', 'Regex', 'DateTime',
    'CoroPool', 'Coro', 'Task', 'Result', 'Option',
]);

// ---------------------------------------------------------------------------
// Primitive type names.
// ---------------------------------------------------------------------------

export const PRIMITIVE_TYPES = new Set([
    'int', 'int8', 'int16', 'int32', 'int64',
    'uint8', 'uint16', 'uint32', 'uint64',
    'float', 'float32', 'float64',
    'string', 'bool', 'void', 'any', 'unknown', 'never',
]);
