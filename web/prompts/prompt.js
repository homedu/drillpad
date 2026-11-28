import '../utils/util_str.js';

const qType = {
    SS: '单选题',
    MS: '多选题',
    FI: '填空题',
    WR: '写作题'
}

// 默认【客观题，选择题】的提示词
const prompt = {
    AZ_900: {
        quiz_name: `这是一道关于AZ-900 Microsoft Azure Fundamentals的练习题,`,
        question_type: "",
        question_ref: "",
        question_profile: "",
        question: "",
        answer_profile: "",
        answer_ref: "",
        answered_sub: "",
        answer_eval: "",
        correct_answer: "请问：正确答案是什么？",
        answer_explanation: "解释为什么这个选项是正确答案？",
        incorrect_explanation: "解释为什么其他选项是错误答案？",
        tested_topic: "题目测试了哪些知识点？",
        other_notes: "通过该题的考察，还有哪些与考试相关的知识点需要掌握或注意的？"
    },
    wordly_wise: {
        quiz_name: `这是一道关于英语词汇学习的练习题,`,
        question_type: "",
        question_ref: "",
        question_profile: "",
        question: "",
        answer_profile: "",
        answer_ref: "",
        answered_sub: "",
        answer_eval: "",
        correct_answer: "请问：正确答案是什么？",
        answer_explanation: "解释为什么这个选项是正确答案？",
        incorrect_explanation: "解释为什么其他选项是错误答案？",
        tested_topic: "",
        other_notes: "通过该题的考察，有哪些相关知识点需要掌握或注意的？"
    },
    writing_describe_scene: {
        quiz_name: `这是一道英文写作练习题`,
        question_type: "关于视频情节的真实生动的还原描述",
        question_ref: "如果此处没有提供原视频,但后面给出了参考答案,你就根据参考答案进行原视频的合理脑补。",
        question_profile: "",
        question: "",
        answer_profile: "如果后面见到[NOT ANSWERED], 则代表考生未作答",
        answer_ref: "",
        answered_sub: "",
        answer_eval: "首先, 对考生提交写作内容进行 0-100 的打分。",
        correct_answer: "其次, 进行拼写、语法、段落组织的检查及指正。同时给出符合该场景的更优秀的用词或句式的使用建议。",
        answer_explanation: "最后, 给出该写作题目的优秀范文。",
        incorrect_explanation: "",
        tested_topic: "",
        other_notes: "通过该题的考察，总结出类似场景的写作思路、词伙及惯用的句式; 帮助考生举一反三。"
    }
}

const makePrompt = (quiz, wrapper) => {
    if (prompt[quiz]) return wrapper(prompt[quiz]);

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

    return null
}

export const getPromptObject = (quiz, type, question, question_ref, isEval = false, answered_sub = "", answer_ref = "") => {

    const wrapper = (po => {
        return {
            ...po,
            question_type: `题目为${isEval ? "主观" : ""}${qType[type]}。`,
            ...(question_ref?.length && { question_ref: `首先，阅读该题目的参考文章或材料内容，即双大括号内的内容: {{ ${question_ref} }}` }),
            ...(type === 'FI' && { question_profile: "" }),
            question: `题目如下：${question}`,
            ...(isEval && { answer_profile: "注意,若有多处需要填写,则使用双分号分隔每个填写位置所对应的作答。[NOT ANSWERED]代表考生未作答。" }),
            ...(isEval && answer_ref?.length && { answer_ref: `同时,该题附带参考答案(同样使用双分号分隔需多处填写的对应答案): ${answer_ref}` }),
            ...(isEval && { answered_sub: `考生实际作答内容如下：${answered_sub}` }),
            ...(isEval && { answer_eval: "首先,对作答内容进行 '正确', '待改进', '错误', '未作答' 四种结论之一的判断。" }),
            ...(isEval && { correct_answer: "其次,若作答不完全正确或未作答，你经过思考，给出正确答案。" }),
            ...(isEval && { answer_explanation: "最后,解释所给正确答案的理由？" }),
            ...(isEval && { incorrect_explanation: "" })
        }
    })

    const wrapper_w = (po => {
        return {
            ...po,
            question: `题目如下：${question}`,
            ...(answer_ref?.length && { answer_ref: `同时,该题附带了参考答案: ${answer_ref}` }),
            answered_sub: answered_sub?.trim() ? `考生实际写作内容如下：${answered_sub}` : "[NOT ANSWERED]",
        }
    })

    let w = type === "WR" ? wrapper_w : wrapper;
    const p = makePrompt(quiz, w);
    if (!p) throw new Error(`No prompt found for quiz: ${quiz}`);
    return p;
}
