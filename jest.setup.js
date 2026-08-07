// @ts-nocheck
'use strict';

// 测试环境隔离：独立测试库 + 临时存储目录 + 抑制日志
// 必须在加载任何 src 模块前设置（setupFiles 先于测试文件执行）
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'anzhiku_test';
process.env.UPLOAD_DIR = './storage/test-files';
process.env.LOG_LEVEL = 'warn';
// 调小大小限制便于测试「超限」路径（正常测试文件仅几百字节）
process.env.MAX_FILE_SIZE_MB = '0.1';
process.env.URL_MAX_SIZE_MB = '0.1';
