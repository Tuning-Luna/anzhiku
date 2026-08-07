// @ts-nocheck
'use strict';

module.exports = (sequelize, DataTypes) => {
  const File = sequelize.define(
    'File',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      originalName: { type: DataTypes.STRING(255), allowNull: false },
      storedName: { type: DataTypes.STRING(255), allowNull: false },
      storageDir: { type: DataTypes.STRING(500), allowNull: false },
      mimeType: { type: DataTypes.STRING(128), allowNull: true },
      extension: { type: DataTypes.STRING(32), allowNull: true },
      sizeBytes: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      sha256: { type: DataTypes.STRING(64), allowNull: true },
      sourceType: {
        type: DataTypes.ENUM('upload', 'url'),
        allowNull: false,
        defaultValue: 'upload',
      },
      sourceUrl: { type: DataTypes.STRING(2048), allowNull: true },
      status: {
        type: DataTypes.ENUM('active', 'deleted'),
        allowNull: false,
        defaultValue: 'active',
      },
    },
    { tableName: 'files', underscored: true }
  );

  File.associate = (models) => {
    File.hasOne(models.QuestionBank, { as: 'bank', foreignKey: 'fileId' });
    File.hasMany(models.ParseTask, { as: 'parseTasks', foreignKey: 'fileId' });
    File.hasMany(models.LlmParseRecord, {
      as: 'llmRecords',
      foreignKey: 'fileId',
    });
  };

  return File;
};
