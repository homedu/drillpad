export const FillType = {
    label: "填空",

    parseAnswer: (answers, id) => {

    },

    hasAnswered: (q, answer) => !!answer,

    isCorrect: (q, answer) => !!q.correctAnswer && !!answer && answer.text.trim() === q.correctAnswer.trim(),

    formatCorrect: (q) => q.correctAnswer,

    Input: function FillInput({ q, answer, onChange, submitted }) {

    },
};