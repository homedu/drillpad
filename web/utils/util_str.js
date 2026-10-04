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