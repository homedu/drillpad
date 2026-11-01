import '../utils/util_str.js';

export const getPromptObject = (quiz, type) => {

    const qTypeDesc = {
        MCSA: '单选题',
        MS: '多选题',
        FILL: '填空题'
    }

    const prompt = {
        AZ_900: {
            quiz_name: `这是关于 AZ-900 Microsoft Azure Fundamentals 方面的 ${qTypeDesc[type]}，题目如下:`,
            question_profile: "双小括号内是问题，双中括号内是选项，选项之间用双分号分隔。",
            notice: "(如果题目毫无信息或毫无逻辑，亦或跟告知的测试方向完全不相关，直接返回即可，无需继续作答)",
            correct_answer: "请问：正确答案是什么？",
            answer_explanation: "解释为什么这个选项是正确答案？",
            incorrect_options_explanation: "解释为什么其他选项是错误答案？",
            tested_topic: "题目测试了哪些知识点？",
            other_notes: "其它相关需要掌握了解或要注意的具体知识点还有哪些？"
        },
        wordly_wise: {
            quiz_name: `这是关于英语词汇学习的 ${qTypeDesc[type]}。练习目的是备考维州精英中学的 Word Reasoning。题目如下:`,
            question_profile: "双小括号内是问题，双中括号内是选项，选项之间用双分号分隔。",
            correct_answer: "请问：正确答案是什么？",
            answer_explanation: "解释为什么这个选项是正确答案？",
            other_notes: "该词、短语或句子在英语学习中还有哪些相关的知识点需要掌握了解或要注意的？"
        }
    }

    if (prompt[quiz]) {
        return prompt[quiz];
    }
    let possible = null;
    quiz.expand('_', '-').forEach(q => {
        if (prompt[q]) {
            possible = q;
            return;
        }
    });
    if (possible) {
        return prompt[possible];
    }
    const tq = quiz.trimTail('-', '_', '.');
    if (prompt[tq]) {
        return prompt[tq];
    }
    throw new Error(`No prompt found for quiz: ${quiz}`);
}