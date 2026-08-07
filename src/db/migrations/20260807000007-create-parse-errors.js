// @ts-nocheck
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('parse_errors', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      task_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'parse_tasks', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      question_index: { type: Sequelize.INTEGER, allowNull: true },
      error_type: {
        type: Sequelize.ENUM(
          'json_parse',
          'schema_validation',
          'category_mismatch',
          'question_validation',
          'llm_error',
          'unknown'
        ),
        allowNull: false,
      },
      error_message: { type: Sequelize.TEXT, allowNull: true },
      raw_question: { type: Sequelize.JSON, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('parse_errors', ['task_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('parse_errors');
  },
};
