// @ts-nocheck
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('parse_tasks', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      file_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'files', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      strategy: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'doc_turbo_single',
      },
      status: {
        type: Sequelize.ENUM(
          'pending',
          'processing',
          'succeeded',
          'partial_failed',
          'failed',
          'cancelled'
        ),
        allowNull: false,
        defaultValue: 'pending',
      },
      model: { type: Sequelize.STRING(64), allowNull: true },
      total_questions: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      success_count: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      failed_count: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      raw_response: { type: Sequelize.TEXT('medium'), allowNull: true },
      error_code: { type: Sequelize.STRING(64), allowNull: true },
      error_message: { type: Sequelize.TEXT, allowNull: true },
      retry_count: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      started_at: { type: Sequelize.DATE, allowNull: true },
      finished_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('parse_tasks', ['file_id']);
    await queryInterface.addIndex('parse_tasks', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('parse_tasks');
  },
};
