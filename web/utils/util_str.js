if (!String.prototype.mustEnd) {
    String.prototype.mustEnd = function (tail, ignoreCase = false) {
        const str = this.toString();
        if (ignoreCase) {
            return str.toLowerCase().endsWith(tail.toLowerCase()) ? str : str + tail;
        }
        return str.endsWith(tail) ? str : str + tail;
    };
}

if (!String.prototype.isValidGuid) {
    String.prototype.isValidGuid = function () {
        const guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
        return guidRegex.test(this.toString());
    };
}

if (!String.prototype.toLiteral) {
    String.prototype.toLiteral = function () {
        const str = this.toString();
        return str.replace(/[\r\n\t]/g, (match) => {
            if (match === '\n') return '\\n';
            if (match === '\r') return '\\r';
            if (match === '\t') return '\\t';
            return match;
        });
    }
}

if (!String.prototype.fromLiteral) {
    String.prototype.fromLiteral = function () {
        const str = this.toString();
        return str.replace(/\\([nrt])/g, (match, char) => {
            if (char === 'n') return '\n';
            if (char === 'r') return '\r';
            if (char === 't') return '\t';
            return match;
        });
    };
}

if (!String.prototype.replaceNth) {
    String.prototype.replaceNth = function (target, index, replacement) {
        const str = this.toString();
        let count = 0; // 计数器，记录当前是第几次匹配（从0开始）
        const regex = new RegExp(target, 'g'); // 使用 RegExp 创建全局正则，动态匹配传入的字符
        return str.replace(regex, (match) => {
            if (count === index) {
                count++;
                return replacement; // 匹配到指定次数，换成新字符
            }
            count++;
            return match; // 不是我们要的目标，原样返回不作修改
        });
    }
}

// only for front-end
if (!String.prototype.isHTML) {
    String.prototype.isHTML = function () {
        const str = this.toString();
        const doc = document.createElement('div');
        doc.innerHTML = str;
        // 遍历子节点，判断是否存在 nodeType === 1 (即 Element 元素节点)
        const children = doc.childNodes;
        for (let i = 0; i < children.length; i++) {
            if (children[i].nodeType === 1) {
                return true;
            }
        }
        return false;
    }
}