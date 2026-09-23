if (!String.prototype.mustEnd) {
    String.prototype.mustEnd = function (tail, ignoreCase = false) {
        const str = this.toString();
        if (ignoreCase) {
            return str.toLowerCase().endsWith(tail.toLowerCase()) ? str : str + tail;
        }
        return str.endsWith(tail) ? str : str + tail;
    };
}