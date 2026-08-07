// @ts-nocheck
'use strict';

module.exports = (sequelize, DataTypes) => {
  const Question = sequelize.define(
    'Question',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      bankId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      type: {
        type: DataTypes.ENUM(
          'single_choice',
          'multi_choice',
          'true_false',
          'fill_blank',
          'short_answer'
        ),
        allowNull: false,
      },
      content: { type: DataTypes.TEXT, allowNull: false },
      options: { type: DataTypes.JSON, allowNull: true },
      answer: { type: DataTypes.JSON, allowNull: true },
      analysis: { type: DataTypes.TEXT, allowNull: true },
      status: {
        type: DataTypes.ENUM('active', 'disabled'),
        allowNull: false,
        defaultValue: 'active',
      },
    },
    { tableName: 'questions', underscored: true }
  );

  Question.associate = (models) => {
    Question.belongsTo(models.QuestionBank, { as: 'bank', foreignKey: 'bankId' });
  };

  return Question;
};
