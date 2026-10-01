export const hasProperty = (val, key) => typeof val === 'object' && val !== null ? Object.hasOwn(val, key) : false;
