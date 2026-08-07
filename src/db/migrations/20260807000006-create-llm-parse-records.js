// @ts-nocheck
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('llm_parse_records', {
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
      file_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: { model: 'files', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      provider: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'aliyun-bailian',
      },
      model: { type: Sequelize.STRING(64), allowNull: true },
      strategy: { type: Sequelize.STRING(32), allowNull: true },
      chunk_index: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      prompt_tokens: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      completion_tokens: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      request_snapshot: { type: Sequelize.JSON, allowNull: true },
      response_snapshot: { type: Sequelize.TEXT('medium'), allowNull: true },
      success: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      error_code: { type: Sequelize.STRING(64), allowNull: true },
      error_message: { type: Sequelize.TEXT, allowNull: true },
      latency_ms: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('llm_parse_records', ['task_id']);
    await queryInterface.addIndex('llm_parse_records', ['file_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('llm_parse_records');
  },
};
