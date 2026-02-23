/**
 * Advanced TypeScript Utility Types
 *
 * Comprehensive collection of utility types for advanced type manipulation,
 * conditional types, mapped types, and template literal types.
 */

// Advanced utility types for object manipulation
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
};

export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

// Conditional utility types
export type NonNullable<T> = T extends null | undefined ? never : T;

export type NonEmptyArray<T> = [T, ...T[]];

export type NonEmptyString<T extends string> = T extends '' ? never : T;

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

// Object manipulation utility types
export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

export type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

export type PickByType<T, U> = Pick<
  T,
  {
    [K in keyof T]: T[K] extends U ? K : never;
  }[keyof T]
>;

export type OmitByType<T, U> = Pick<
  T,
  {
    [K in keyof T]: T[K] extends U ? never : K;
  }[keyof T]
>;

// String manipulation utility types
export type Split<S extends string, D extends string> = S extends `${infer T}${D}${infer U}`
  ? [T, ...Split<U, D>]
  : [S];

export type Join<T extends readonly string[], D extends string = ''> = T extends readonly [
  infer F,
  ...infer R,
]
  ? F extends string
    ? R extends readonly string[]
      ? R['length'] extends 0
        ? F
        : `${F}${D}${Join<R, D>}`
      : never
    : never
  : '';

export type CamelCase<S extends string> = S extends `${infer P1}_${infer P2}${infer P3}`
  ? `${P1}${Capitalize<CamelCase<`${P2}${P3}`>>}`
  : S;

export type KebabCase<S extends string> = S extends `${infer C}${infer T}`
  ? C extends Uppercase<C>
    ? `-${Lowercase<C>}${KebabCase<T>}`
    : `${C}${KebabCase<T>}`
  : S;

export type SnakeCase<S extends string> = S extends `${infer C}${infer T}`
  ? C extends Uppercase<C>
    ? `_${Lowercase<C>}${SnakeCase<T>}`
    : `${C}${SnakeCase<T>}`
  : S;

// Template literal utility types for API paths
export type ApiPath = `/api/${string}`;

export type ApiEndpoint<T extends string> = `/api/${T}`;

export type DynamicPath<T extends string> = `${T}/:${string}`;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type RouteDefinition<Path extends string, Method extends HttpMethod = 'GET'> = {
  path: Path;
  method: Method;
};

// Form field utility types
export type FormField<T> = {
  value: T;
  error?: string;
  touched: boolean;
  dirty: boolean;
};

export type FormState<T extends Record<string, any>> = {
  [K in keyof T]: FormField<T[K]>;
} & {
  isValid: boolean;
  isSubmitting: boolean;
  errors: Partial<Record<keyof T, string>>;
};

// Event handler utility types
export type EventHandler<T = Event> = (event: T) => void;

export type AsyncEventHandler<T = Event> = (event: T) => Promise<void>;

export type ChangeHandler<T> = (value: T) => void;

export type SubmitHandler<T> = (data: T) => Promise<void> | void;

// React component utility types
export type ComponentProps<T> = T extends React.ComponentType<infer P> ? P : never;

export type PropsWithChildren<P = {}> = P & {
  children?: React.ReactNode;
};

export type PropsWithClassName<P = {}> = P & {
  className?: string;
};

export type PropsWithOptionalChildren<P = {}> = P & {
  children?: React.ReactNode;
};

// Conditional rendering utility types
export type ConditionalProps<T, Condition extends boolean> = Condition extends true ? T : never;

export type RequiredProps<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type PartialProps<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Error handling utility types (moved to error-handling.ts to avoid conflicts)
export type AsyncResult<T, E = Error> = Promise<import('./error-handling').Result<T, E>>;

export type Try<T> = import('./error-handling').Result<T, string>;

export type AsyncTry<T> = Promise<Try<T>>;

// Database utility types
export type WithTimestamps = {
  createdAt: string;
  updatedAt?: string;
};

export type WithId<T = number> = {
  id: T;
};

export type Entity<T = number> = WithId<T> & WithTimestamps;

export type CreateInput<T> = Omit<T, keyof Entity>;

export type UpdateInput<T> = Partial<Omit<T, keyof Entity>>;

// API utility types
export type PaginationInput = {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
};

export type FilterInput<T> = {
  [K in keyof T]?: T[K] | T[K][];
};

export type SearchInput<T> = {
  query?: string;
  filters?: FilterInput<T>;
} & PaginationInput;

// Type assertion utilities
export type Assert<T, U> = T extends U ? T : never;

export type IsExact<T, U> =
  (<G>() => G extends T ? 1 : 2) extends <G>() => G extends U ? 1 : 2 ? true : false;

export type IsUnion<T> = [T] extends [UnionToIntersection<T>] ? false : true;

// Function utility types
export type Awaited<T> = T extends Promise<infer U> ? U : T;

export type ReturnTypeAsync<T extends (...args: any[]) => Promise<any>> = Awaited<ReturnType<T>>;

export type ParametersAsync<T extends (...args: any[]) => Promise<any>> = Parameters<T>;

// Array utility types
export type Head<T extends readonly unknown[]> = T extends readonly [infer H, ...unknown[]]
  ? H
  : never;

export type Tail<T extends readonly unknown[]> = T extends readonly [unknown, ...infer Tail]
  ? Tail
  : [];

export type ArrayElement<T> = T extends readonly (infer U)[] ? U : never;

export type Tuple<T, N extends number> = N extends N
  ? number extends N
    ? T[]
    : _TupleOf<T, N, []>
  : never;

type _TupleOf<T, N extends number, R extends unknown[]> = R['length'] extends N
  ? R
  : _TupleOf<T, N, [...R, T]>;

// Object key utility types
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

export type StringKeys<T> = KeysOfType<T, string>;

export type NumberKeys<T> = KeysOfType<T, number>;

export type BooleanKeys<T> = KeysOfType<T, boolean>;

// Type predicate utilities
export const isString = (value: unknown): value is string => typeof value === 'string';

export const isNumber = (value: unknown): value is number => typeof value === 'number';

export const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isArray = <T>(value: unknown): value is T[] => Array.isArray(value);

export const isDefined = <T>(value: T | undefined | null): value is T =>
  value !== undefined && value !== null;

export const isNonEmpty = <T>(value: T[]): value is NonEmptyArray<T> =>
  Array.isArray(value) && value.length > 0;

// Type-safe environment variable utility
export type EnvVar<T extends string> = T extends `${string}_URL`
  ? string
  : T extends `${string}_PORT`
    ? number
    : T extends `${string}_ENABLED`
      ? boolean
      : string;

export const getEnvVar = <T extends string>(key: T, defaultValue?: EnvVar<T>): EnvVar<T> => {
  const value = process.env[key];

  if (value === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Environment variable ${key} is not defined`);
  }

  // Type-based conversion
  if (key.endsWith('_PORT')) {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) throw new Error(`Invalid port number for ${key}: ${value}`);
    return parsed as EnvVar<T>;
  }

  if (key.endsWith('_ENABLED')) {
    const bool = value.toLowerCase();
    if (!['true', 'false'].includes(bool)) {
      throw new Error(`Invalid boolean value for ${key}: ${value}`);
    }
    return (bool === 'true') as EnvVar<T>;
  }

  return value as EnvVar<T>;
};
