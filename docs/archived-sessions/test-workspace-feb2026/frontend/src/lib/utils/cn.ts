/**
 * Class name utility
 * Combines class names and handles conditional classes
 */

export type ClassValue = string | number | boolean | undefined | null;

/**
 * Combines class names, filtering out falsy values
 */
export function cn(...classes: ClassValue[]): string {
  return classes
    .filter(c => Boolean(c) && typeof c === 'string')
    .join(' ')
    .trim();
}

/**
 * Alternative using clsx-like syntax for more complex cases
 */
export function classNames(...inputs: any[]): string {
  const classes: string[] = [];

  for (const input of inputs) {
    if (!input) continue;

    if (typeof input === 'string') {
      classes.push(input);
    } else if (Array.isArray(input)) {
      const nested = classNames(...input);
      if (nested) classes.push(nested);
    } else if (typeof input === 'object') {
      for (const key in input) {
        if (input[key]) classes.push(key);
      }
    }
  }

  return classes.join(' ');
}
