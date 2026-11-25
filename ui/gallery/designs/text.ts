// Gallery card text: dimensions, counts and signatures.
import type { Row } from './state.js';
import { pageOf } from '../../engine/index.js';

export function dims(format: string, width?: number, height?: number): string {
  return pageOf(format ?? 'story', width, height).label;
}

export function itemCount(items: number): string {
  return `${items} item${items === 1 ? '' : 's'}`;
}

export function signatureOf(row: Row): string {
  return [row.name, row.format, row.width ?? '', row.height ?? '', row.items].join('|');
}