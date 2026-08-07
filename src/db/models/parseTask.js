// @ts-nocheck
'use strict';

module.exports = (sequelize, DataTypes) => {
  const ParseTask = sequelize.define(
    'ParseTask',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      fileId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      strategy: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'doc_turbo_single',
      },
      status: {
        type: DataTypes.ENUM(
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
      model: { type: DataTypes.STRING(64), allowNull: true },
      totalQuestions: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      successCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      failedCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      rawResponse: { type: DataTypes.TEXT('medium'), allowNull: true },
      errorCode: { type: DataTypes.STRING(64), allowNull: true },
      errorMessage: { type: DataTypes.TEXT, allowNull: true },
      retryCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      startedAt: { type: DataTypes.DATE, allowNull: true },
      finishedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { tableName: 'parse_tasks', underscored: true }
  );

  ParseTask.associate = (models) => {
    ParseTask.belongsTo(models.File, { as: 'file', foreignKey: 'fileId' });
    ParseTask.hasMany(models.LlmParseRecord, {
      as: 'llmRecords',
      foreignKey: 'taskId',
    });
    ParseTask.hasMany(models.ParseError, { as: 'errors', foreignKey: 'taskId' });
  };

  return ParseTask;
};
