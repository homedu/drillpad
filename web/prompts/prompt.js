import '../utils/util_str.js';

const qType = {
    MCSA: '单选题',
    MS: '多选题',
    FILL: '填空题'
}

// 默认【客观题，选择题】的提示词
const prompt = {
    AZ_900: {
        quiz_name: `这是关于 AZ-900 Microsoft Azure Fundamentals 方面的练习题,`,
        question_type: "",
        question: "",
        question_profile: "注意：双小括号内是问题，双中括号内是选项，选项间用双分号分隔。",
        question_eval: "",
        question_ref: "",
        correct_answer: "请问：正确答案是什么？",
        answer_explanation: "解释为什么这个选项是正确答案？",
        incorrect_explanation: "解释为什么其他选项是错误答案？",
        tested_topic: "题目测试了哪些知识点？",
        other_notes: "其它应对考试的相关需要掌握了解或要注意的具体知识点还有哪些？"
    },
    wordly_wise: {
        quiz_name: `这是关于英语词汇学习的练习题,`,
        question_type: "",
        question: "",
        question_profile: "注意：双小括号内是问题，双中括号内是选项，选项间用双分号分隔",
        question_eval: "",
        question_ref: "",
        correct_answer: "请问：正确答案是什么？",
        answer_explanation: "解释为什么这个选项是正确答案？",
        incorrect_explanation: "解释为什么其他选项是错误答案？",
        tested_topic: "",
        other_notes: "通过该题的考察，在英语词汇学习中还有哪些相关的知识点需要掌握或要注意的？"
    }
}

export const getPromptObject = (quiz, type, question, question_ref, isEval = false) => {

    const wrapper = (po => {
        return {
            ...po,
            question_type: `题目类型是：${qType[type]},`,
            question: `题目如下：${question}.`,
            ...(type === 'FILL' && { question_profile: "注意：双小括号内是问题; 双中括号内是作答; 若问题有多个空格需要填写，则对应空格的作答依ABC字母顺序填写，且双分号分隔。" }),
            ...(isEval && { question_eval: "该题为主观题。需要你作为考官，首先对作答进行'正确', '待改进', '错误'三种结论之一的判断。" }),
            ...(question_ref?.length && { question_ref: `同时：对该问题的作答正误判断或讲解，要参考双大括号内的材料内容(可能是HTML格式)：{{ ${question_ref} }}` }),
            ...(isEval && { correct_answer: "如果作答不完全正确，正确的答案应该是什么？" }),
            ...(isEval && { answer_explanation: "如果作答不完全正确，解释下你给出的正确答案的理由？" }),
            ...(isEval && { incorrect_explanation: "如果作答不完全正确，错误作答又错在了哪里？" })
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
