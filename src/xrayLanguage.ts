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
    'var', 'const', 'fn', 'class', 'struct', 'packed', 'union', 'interface', 'enum', 'type',
    'comptime',
    // Primitive type keywords
    'int', 'int8', 'int16', 'int32', 'int64', 'byte',
    'uint8', 'uint16', 'uint32', 'uint64',
    'float', 'float32', 'float64', 'string', 'bool', 'rune',
    // Control flow
    'if', 'else', 'while', 'for', 'in', 'is', 'break', 'continue',
    'return', 'yield', 'match', 'default',
    // Class / OOP
    'extends', 'implements', 'constructor', 'this', 'super',
    'new', 'static', 'private', 'protected', 'final',
    'operator',
    // Error handling
    'try', 'catch', 'throw', 'panic',
    // Module system
    'import', 'export', 'from', 'as',
    // Concurrency
    'go', 'await', 'select', 'defer', 'scope', 'linked', 'supervisor', 'after',
    'cancelled', 'shared',
    // Contextual
    'ref', 'move', 'to', 'unsafe',
    // Literals that look like keywords
    'true', 'false', 'null',
]);

// ---------------------------------------------------------------------------
// Built-in global functions (callable without import).
// ---------------------------------------------------------------------------

export const BUILTIN_FUNCTIONS = new Set([
    'print', 'dump', 'typeOf', 'typeName',
    'assert', 'assert_eq', 'assert_ne', 'assert_true', 'assert_false',
    'assert_throws',
    'int', 'float', 'string', 'bool', 'rune',
    'copy', 'chr',
    'Coro',
]);

// ---------------------------------------------------------------------------
// Literal constants (subset of keywords used for literal-specific colouring).
// ---------------------------------------------------------------------------

export const LITERALS = new Set(['true', 'false', 'null']);

// ---------------------------------------------------------------------------
// Built-in type names (container types, utility types).
// ---------------------------------------------------------------------------

export const BUILTIN_TYPES = new Set([
    'Array', 'Map', 'Set', 'Slice', 'Json', 'Channel', 'BigInt',
    'Range', 'StringBuilder', 'Regex', 'RegexMatch',
    'Path', 'Ptr', 'MutPtr',
    'OsBarrier', 'OsCondvar', 'OsMutex', 'OsOnce', 'OsRwLock',
    'NetConn', 'NetListener',
    'Task', 'Thread', 'WorkQueue', 'CountdownLatch', 'EventCount',
    'ResultGroup', 'Semaphore',
    'Result', 'Atomic', 'Ordering', 'Endian', 'Type', 'Recv', 'SendResult',
    'TaskResult', 'TaskStatus', 'PanicInfo',
    'Utf8Error', 'StringSliceError', 'CompressionError', 'CryptoError',
]);

// ---------------------------------------------------------------------------
// Primitive type names.
// ---------------------------------------------------------------------------

export const PRIMITIVE_TYPES = new Set([
    'int', 'int8', 'int16', 'int32', 'int64', 'byte',
    'uint8', 'uint16', 'uint32', 'uint64',
    'float', 'float32', 'float64',
    'string', 'bool', 'rune',
]);
