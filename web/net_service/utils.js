import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs) => twMerge(clsx(inputs));
export const hasProperty = (val, key) => typeof val === 'object' && val !== null ? Object.hasOwn(val, key) : false;
