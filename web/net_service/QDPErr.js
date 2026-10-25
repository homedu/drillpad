export class QuizListError extends Error {
    constructor(message, stage, options = {}) {
        super(message, options);
        this.name = "QuizListError";
        this.stage = stage;
    }
}

export class QACountError extends Error {
    constructor(message, stage, options = {}) {
        super(message, options);
        this.name = "QACountError";
        this.stage = stage;
    }
}

export class QuestionSearchError extends Error {
    constructor(message, stage, options = {}) {
        super(message, options);
        this.name = "QuestionSearchError";
        this.stage = stage;
    }
}

export class QuestionRateError extends Error {
    constructor(message, stage, options = {}) {
        super(message, options);
        this.name = "QuestionRateError";
        this.stage = stage;
    }
}

export class QuestionRateFetchError extends Error {
    constructor(message, stage, options = {}) {
        super(message, options);
        this.name = "QuestionRateFetchError";
        this.stage = stage;
    }
}

export class QuestionDeleteError extends Error {
    constructor(message, stage, options = {}) {
        super(message, options);
        this.name = "QuestionDeleteError";
        this.stage = stage;
    }
}

export class QuizMakeError extends Error {
    constructor(message, stage, options = {}) {
        super(message, options);
        this.name = "QuizMakeError";
        this.stage = stage;
    }
}

export class GroupContentSaveError extends Error {
    constructor(message, stage, options = {}) {
        super(message, options);
        this.name = "GroupContentSaveError";
        this.stage = stage;
    }
}

export class GroupContentFetchError extends Error {
    constructor(message, stage, options = {}) {
        super(message, options);
        this.name = "GroupContentFetchError";
        this.stage = stage;
    }
}

export class GroupListError extends Error {
    constructor(message, stage, options = {}) {
        super(message, options);
        this.name = "GroupListError";
        this.stage = stage;
    }
}

export class QuizFetchError extends Error {
    constructor(message, stage, options = {}) {
        super(message, options);
        this.name = "QuizFetchError";
        this.stage = stage;
    }
}

export class AnswerRecordError extends Error {
    constructor(message, stage, options = {}) {
        super(message, options);
        this.name = "AnswerRecordError";
        this.stage = stage;
    }
}