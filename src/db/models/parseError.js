// @ts-nocheck
'use strict';

module.exports = (sequelize, DataTypes) => {
  const ParseError = sequelize.define(
    'ParseError',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      taskId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      questionIndex: { type: DataTypes.INTEGER, allowNull: true },
      errorType: {
        type: DataTypes.ENUM(
          'json_parse',
          'schema_validation',
          'category_mismatch',
          'question_validation',
          'llm_error',
          'unknown'
        ),
        allowNull: false,
      },
      errorMessage: { type: DataTypes.TEXT, allowNull: true },
      rawQuestion: { type: DataTypes.JSON, allowNull: true },
    },
    { tableName: 'parse_errors', underscored: true }
  );

  ParseError.associate = (models) => {
    ParseError.belongsTo(models.ParseTask, { as: 'task', foreignKey: 'taskId' });
  };

  return ParseError;
};
