import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs) => twMerge(clsx(inputs));

export const hasProperty = (val, key) => typeof val === 'object' && val !== null ? Object.hasOwn(val, key) : false;

export const arraysEqualUnordered = (arr1, arr2) => {
    if (arr1.length !== arr2.length) return false;
    const countMap = new Map();
    for (const item of arr1) {
        countMap.set(item, (countMap.get(item) || 0) + 1);
    }
    for (const item of arr2) {
        if (!countMap.has(item)) return false;
        const count = countMap.get(item);
        if (count === 1) {
            countMap.delete(item);
        } else {
            countMap.set(item, count - 1);
        }
    }
    return countMap.size === 0;
}