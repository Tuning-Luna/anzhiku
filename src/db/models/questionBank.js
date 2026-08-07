// @ts-nocheck
'use strict';

module.exports = (sequelize, DataTypes) => {
  const QuestionBank = sequelize.define(
    'QuestionBank',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      name: { type: DataTypes.STRING(255), allowNull: false },
      fileId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      categoryId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      subCategoryId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      questionCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      status: {
        type: DataTypes.ENUM('active', 'deleted'),
        allowNull: false,
        defaultValue: 'active',
      },
    },
    { tableName: 'question_banks', underscored: true }
  );

  QuestionBank.associate = (models) => {
    QuestionBank.belongsTo(models.File, { as: 'file', foreignKey: 'fileId' });
    QuestionBank.belongsTo(models.Category, {
      as: 'category',
      foreignKey: 'categoryId',
    });
    QuestionBank.belongsTo(models.Category, {
      as: 'subCategory',
      foreignKey: 'subCategoryId',
    });
    QuestionBank.hasMany(models.Question, { as: 'questions', foreignKey: 'bankId' });
  };

  return QuestionBank;
};
