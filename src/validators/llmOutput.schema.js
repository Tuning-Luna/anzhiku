// @ts-nocheck
'use strict';

const Ajv = require('ajv');

const ajv = new Ajv({ allErrors: true, strict: false });

const QUESTION_TYPES = [
  'single_choice',
  'multi_choice',
  'true_false',
  'fill_blank',
  'short_answer',
];

/** LLM 输出结构校验（Qwen 不支持按 Schema 生成，故由后端强校验） */
const schema = {
  type: 'object',
  required: ['questions'],
  properties: {
    category: { type: 'string' },
    subCategory: { type: ['string', 'null'] },
    questions: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['type', 'content'],
        properties: {
          type: { enum: QUESTION_TYPES },
          content: { type: 'string', minLength: 1 },
          options: {
            type: ['array', 'object', 'null'],
            items: {
              type: 'object',
              required: ['label', 'content'],
              properties: {
                label: { type: 'string' },
                content: { type: 'string' },
              },
            },
          },
          answer: {},
          analysis: { type: 'string' },
        },
      },
    },
  },
};

const validate = ajv.compile(schema);

function errorsText() {
  return validate.errors ? ajv.errorsText(validate.errors) : '';
}

module.exports = { schema, validate, errorsText, QUESTION_TYPES };
