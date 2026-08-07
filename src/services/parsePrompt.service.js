// @ts-nocheck
'use strict';

/**
 * 题库提取提示词。Qwen API 不支持按 JSON Schema 生成，
 * 因此结构靠提示词强约束 + 后端 ajv Schema 校验兜底。
 */
function buildExtractionPrompt() {
  return `你是题库结构化提取引擎。请阅读我提供的文档，提取其中的全部题目，并输出一个合法的 JSON 对象。

【输出格式】只输出 JSON 字符串本身，不要输出任何其他文字，不要使用 markdown 代码块包裹。
JSON 结构必须是：
{
  "category": "一级分类",
  "subCategory": "二级分类 或 null",
  "questions": [
    {
      "type": "single_choice 或 multi_choice 或 true_false 或 fill_blank 或 short_answer",
      "content": "题干",
      "options": [{"label": "A", "content": "选项内容"}],
      "answer": "见下方题型规则",
      "analysis": "解析说明，没有则填空字符串"
    }
  ]
}

【分类规则】
- 一级分类 category 只能是：电工作业 / 焊接与热切割作业 / 高处作业
- 二级分类 subCategory：电工作业 对应 低压电工作业 / 高压电工作业；高处作业 对应 登高架设作业 / 高处安装、维护、拆除作业；焊接与热切割作业 没有二级分类，subCategory 必须为 null
- 文档没有明确分类时，根据题目内容推断最合适的一级分类；二级分类无法确定则为 null

【题型规则】
- single_choice 单选题：options 至少 2 项；answer 为单个大写字母，如 "A"
- multi_choice 多选题：options 至少 2 项；answer 为大写字母数组，如 ["A", "B"]
- true_false 判断题：不要 options；answer 为布尔值 true 或 false（"正确/对/√"→true，"错误/错/×"→false）
- fill_blank 填空题：不要 options；answer 为答案字符串（一题一空）
- short_answer 简答题：不要 options；answer 为参考答案字符串

【注意】
1. 每个题目必须包含 type 与 content，不得遗漏任何题目。
2. 题干、选项、答案必须原文完整保留，不要改写、不要翻译。
3. 无法确定的题目也要提取出来，在 answer 中给出最可能的值。`;
}

module.exports = { buildExtractionPrompt };
