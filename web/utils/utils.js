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

/**
 * 枚举字符串中所有"可替换字符"位置的全部取值组合
 *
 * @param {string} str      输入字符串
 * @param {...string} chars 可互相替换的字符(任意个,每项必须是单个字符,如 '_', '-', '.')
 * @returns {string[]}      所有可能的字符串(按字典序的位置进位顺序,无重复)
 *
 * 示例:
 *   expand('a_b-c', '_', '-')  => ['a_b_c', 'a_b-c', 'a-b_c', 'a-b-c']
 */
export function expand(str, ...chars) {
    if (typeof str !== 'string') throw new TypeError('str must be a string');

    // 去重 + 校验(按 Unicode 码点处理,兼容 emoji 等代理对字符)
    const set = [...new Set(chars.flat())];
    if (set.length === 0) return [str];
    for (const c of set) {
        if ([...c].length !== 1) throw new TypeError(`Invalid char: "${c}"`);
    }
    const lookup = new Set(set);

    // 按码点切分,把字符串拆成:固定片段 + 可变位置
    const parts = [];      // 交替存放: 固定文本
    const slots = 0;       // 占位,下面统计
    let fixed = '';
    let slotCount = 0;
    for (const ch of str) {
        if (lookup.has(ch)) {
            parts.push(fixed);
            fixed = '';
            slotCount++;
        } else {
            fixed += ch;
        }
    }
    parts.push(fixed); // parts.length === slotCount + 1

    if (slotCount === 0) return [str];

    const base = set.length;
    const total = Math.pow(base, slotCount);
    if (!Number.isSafeInteger(total) || total > 2 ** 24) {
        throw new RangeError(
            `Too many combinations: ${base}^${slotCount}. Use expandIter() instead.`
        );
    }

    // 用"计数器"逐位进位生成,避免递归与重复拼接
    const result = new Array(total);
    const idx = new Array(slotCount).fill(0);

    for (let n = 0; n < total; n++) {
        let s = parts[0];
        for (let i = 0; i < slotCount; i++) {
            s += set[idx[i]] + parts[i + 1];
        }
        result[n] = s;

        // 末位 +1 并进位
        for (let i = slotCount - 1; i >= 0; i--) {
            if (++idx[i] < base) break;
            idx[i] = 0;
        }
    }
    return result;
}

/**
 * 惰性版本(生成器):组合数巨大时使用,不占用大量内存
 */
export function* expandIter(str, ...chars) {
    if (typeof str !== 'string') throw new TypeError('str must be a string');
    const set = [...new Set(chars.flat())];
    if (set.length === 0) { yield str; return; }
    for (const c of set) {
        if ([...c].length !== 1) throw new TypeError(`Invalid char: "${c}"`);
    }
    const lookup = new Set(set);

    const parts = [];
    let fixed = '';
    for (const ch of str) {
        if (lookup.has(ch)) { parts.push(fixed); fixed = ''; }
        else fixed += ch;
    }
    parts.push(fixed);
    const slotCount = parts.length - 1;
    if (slotCount === 0) { yield str; return; }

    const base = set.length;
    const idx = new Array(slotCount).fill(0);
    while (true) {
        let s = parts[0];
        for (let i = 0; i < slotCount; i++) s += set[idx[i]] + parts[i + 1];
        yield s;

        let i = slotCount - 1;
        for (; i >= 0; i--) {
            if (++idx[i] < base) break;
            idx[i] = 0;
        }
        if (i < 0) return;
    }
}

/**
 * 从后往前扫描字符串,遇到的第一个"目标字符"处截断,丢弃该字符及其后面的全部内容
 *
 * @param {string} str        输入字符串
 * @param {...string} chars   目标字符(任意个,每项必须是单个字符);也可直接传一个数组
 * @returns {string}          截断后剩下的部分;若没有找到任何目标字符,原样返回
 *
 * 示例:
 *   trimTail('abc-xyz.444', '-', '.')   => 'abc-xyz'
 *   trimTail('abc-xyz.444', ['-', '.']) => 'abc-xyz'
 *   trimTail('abc-xyz', '.')            => 'abc-xyz'  (没找到,原样返回)
 */
export function trimTail(str, ...chars) {
    if (typeof str !== 'string') throw new TypeError('str must be a string');

    const set = chars.flat();
    if (set.length === 0) return str;

    const lookup = new Set();
    for (const c of set) {
        if (typeof c !== 'string' || [...c].length !== 1) {
            throw new TypeError(`Invalid char: "${c}"`);
        }
        lookup.add(c);
    }

    // 从后往前逐个码点扫描(兼容 emoji 等代理对字符)
    for (let i = str.length - 1; i >= 0; i--) {
        let start = i;
        const code = str.charCodeAt(i);

        // 如果是低位代理且前面是高位代理,说明这是一个完整的双字节码点,一起处理
        if (code >= 0xDC00 && code <= 0xDFFF && i > 0) {
            const prev = str.charCodeAt(i - 1);
            if (prev >= 0xD800 && prev <= 0xDBFF) start = --i;
        }

        if (lookup.has(str.slice(start, start === i ? i + 1 : i + 2))) {
            return str.slice(0, start);
        }
    }
    return str; // 没找到任何目标字符
}