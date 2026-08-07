// @ts-nocheck
'use strict';

module.exports = (sequelize, DataTypes) => {
  const Category = sequelize.define(
    'Category',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      name: { type: DataTypes.STRING(100), allowNull: false },
      parentId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      level: { type: DataTypes.TINYINT, allowNull: false },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    { tableName: 'categories', underscored: true }
  );

  Category.associate = (models) => {
    Category.hasMany(models.Category, { as: 'children', foreignKey: 'parentId' });
    Category.belongsTo(models.Category, { as: 'parent', foreignKey: 'parentId' });
  };

  return Category;
};
