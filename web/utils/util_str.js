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