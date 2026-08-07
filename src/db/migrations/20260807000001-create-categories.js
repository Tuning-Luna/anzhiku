// @ts-nocheck
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('categories', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      name: { type: Sequelize.STRING(100), allowNull: false },
      parent_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: true },
      level: { type: Sequelize.TINYINT, allowNull: false },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('categories', ['parent_id']);
    await queryInterface.addIndex('categories', ['parent_id', 'name']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('categories');
  },
};
