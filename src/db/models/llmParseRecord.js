// @ts-nocheck
'use strict';

module.exports = (sequelize, DataTypes) => {
  const LlmParseRecord = sequelize.define(
    'LlmParseRecord',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      taskId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      fileId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      provider: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'aliyun-bailian',
      },
      model: { type: DataTypes.STRING(64), allowNull: true },
      strategy: { type: DataTypes.STRING(32), allowNull: true },
      chunkIndex: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      promptTokens: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      completionTokens: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      requestSnapshot: { type: DataTypes.JSON, allowNull: true },
      responseSnapshot: { type: DataTypes.TEXT('medium'), allowNull: true },
      success: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      errorCode: { type: DataTypes.STRING(64), allowNull: true },
      errorMessage: { type: DataTypes.TEXT, allowNull: true },
      latencyMs: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    },
    { tableName: 'llm_parse_records', underscored: true }
  );

  LlmParseRecord.associate = (models) => {
    LlmParseRecord.belongsTo(models.ParseTask, { as: 'task', foreignKey: 'taskId' });
    LlmParseRecord.belongsTo(models.File, { as: 'file', foreignKey: 'fileId' });
  };

  return LlmParseRecord;
};
