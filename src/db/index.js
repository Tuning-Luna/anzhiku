// @ts-nocheck
'use strict';

const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');
const config = require('../config');
const logger = require('../config/logger');

const sequelize = new Sequelize(
  config.db.database,
  config.db.username,
  config.db.password,
  {
    host: config.db.host,
    port: config.db.port,
    dialect: config.db.dialect,
    logging: (msg) => logger.debug(msg),
    define: { underscored: true },
  }
);

// 自动加载 models 目录下的所有模型并注册关联
const models = {};

fs.readdirSync(path.join(__dirname, 'models'))
  .filter((file) => file.endsWith('.js'))
  .forEach((file) => {
    const model = require(path.join(__dirname, 'models', file))(
      sequelize,
      DataTypes
    );
    models[model.name] = model;
  });

Object.values(models).forEach((model) => {
  if (typeof model.associate === 'function') {
    model.associate(models);
  }
});

module.exports = { sequelize, models };
