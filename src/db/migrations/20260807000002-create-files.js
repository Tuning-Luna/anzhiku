// @ts-nocheck
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('files', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      original_name: { type: Sequelize.STRING(255), allowNull: false },
      stored_name: { type: Sequelize.STRING(255), allowNull: false },
      storage_dir: { type: Sequelize.STRING(500), allowNull: false },
      mime_type: { type: Sequelize.STRING(128), allowNull: true },
      extension: { type: Sequelize.STRING(32), allowNull: true },
      size_bytes: { type: Sequelize.BIGINT.UNSIGNED, allowNull: true },
      sha256: { type: Sequelize.STRING(64), allowNull: true },
      source_type: {
        type: Sequelize.ENUM('upload', 'url'),
        allowNull: false,
        defaultValue: 'upload',
      },
      source_url: { type: Sequelize.STRING(2048), allowNull: true },
      status: {
        type: Sequelize.ENUM('active', 'deleted'),
        allowNull: false,
        defaultValue: 'active',
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('files', ['status']);
    await queryInterface.addIndex('files', ['created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('files');
  },
};
