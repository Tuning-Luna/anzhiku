// @ts-nocheck
'use strict';

// sequelize-cli 专用配置（CLI 是独立进程，需要自己加载 .env）
const dotenv = require('dotenv');
dotenv.config({ quiet: true });

const base = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'anzhiku',
  dialect: 'mysql',
  define: { underscored: true },
};

module.exports = {
  development: { ...base },
  test: { ...base, database: `${base.database}_test`, logging: false },
  production: { ...base },
};
