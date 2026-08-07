// @ts-nocheck
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('questions', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      bank_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'question_banks', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      type: {
        type: Sequelize.ENUM(
          'single_choice',
          'multi_choice',
          'true_false',
          'fill_blank',
          'short_answer'
        ),
        allowNull: false,
      },
      content: { type: Sequelize.TEXT, allowNull: false },
      options: { type: Sequelize.JSON, allowNull: true },
      answer: { type: Sequelize.JSON, allowNull: true },
      analysis: { type: Sequelize.TEXT, allowNull: true },
      status: {
        type: Sequelize.ENUM('active', 'disabled'),
        allowNull: false,
        defaultValue: 'active',
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('questions', ['bank_id']);
    await queryInterface.addIndex('questions', ['type']);
    await queryInterface.addIndex('questions', ['status']);

    // 中文全文检索：ngram 解析器（MySQL 8 内置）
    await queryInterface.sequelize.query(
      'ALTER TABLE questions ADD FULLTEXT INDEX questions_content_fulltext (content) WITH PARSER ngram'
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('questions');
  },
};
