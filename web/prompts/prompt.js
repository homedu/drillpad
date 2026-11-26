import '../utils/util_str.js';

const qType = {
    MCSA: '单选题',
    MS: '多选题',
    FILL: '填空题'
}

// 默认【客观题，选择题】的提示词
const prompt = {
    AZ_900: {
        quiz_name: `这是一道关于AZ-900 Microsoft Azure Fundamentals的练习题,`,
        question_type: "",
        question: "",
        question_profile: "",
        question_eval: "",
        question_ref: "",
        correct_answer: "请问：正确答案是什么？",
        answer_explanation: "解释为什么这个选项是正确答案？",
        incorrect_explanation: "解释为什么其他选项是错误答案？",
        tested_topic: "题目测试了哪些知识点？",
        other_notes: "其它应对考试的相关需要掌握了解或要注意的具体知识点还有哪些？"
    },
    wordly_wise: {
        quiz_name: `这是一道关于英语词汇学习的练习题,`,
        question_type: "",
        question: "",
        question_profile: "",
        question_eval: "",
        question_ref: "",
        correct_answer: "请问：正确答案是什么？",
        answer_explanation: "解释为什么这个选项是正确答案？",
        incorrect_explanation: "解释为什么其他选项是错误答案？",
        tested_topic: "",
        other_notes: "通过该题的考察，还有哪些相关知识点需要掌握或注意的？"
    }
}

export const getPromptObject = (quiz, type, question, question_ref, isEval = false) => {

    const wrapper = (po => {
        return {
            ...po,
            question_type: `题目为${isEval ? "主观" : ""}${qType[type]}。`,
            ...(question_ref?.length && { question_ref: `首先，参考该题目的相关资料，即双大括号内的内容: {{ ${question_ref} }}` }),
            question: `题目如下：${question}.`,
            ...(type === 'FILL' && { question_profile: "" }),
            ...(isEval && { question_eval: "首先对已作答内容进行 '正确', '待改进', '错误' 三种结论之一的判断。" }),
            ...(isEval && { correct_answer: "如果作答不完全正确或未作答，那正确的答案是什么？并解释给出的正确答案的理由？" }),
            ...(isEval && { answer_explanation: "" }),
            ...(isEval && { incorrect_explanation: "" })
        }
    })

    if (prompt[quiz]) return prompt[quiz];

    const [lower, upper, title] = quiz.caseVariants();
    for (const qz of [lower, upper, title]) {
        let possible = null;
        const expandedQuizList = qz.expand('_', '-', ' ');
        expandedQuizList.forEach(q => {
            if (prompt[q]) possible = q;
        });
        if (possible) return wrapper(prompt[possible]);
    }
    for (const qz of [lower, upper, title]) {
        let possible = null;
        const expandedQuizList = qz.expand('_', '-', ' ');
        expandedQuizList.forEach(q => {
            const tq = q.trimTail('_', '-', ' ', '.');
            if (tq.length / q.length > 0.7) {
                if (prompt[tq]) possible = tq;
            }
        });
        if (possible) return wrapper(prompt[possible]);
    }

    throw new Error(`No prompt found for quiz: ${quiz}`);
}
