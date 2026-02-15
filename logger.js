// 导入log4js（ESM格式）
import log4js from 'log4js';

log4js.configure({
  appenders: {
    console: { type: 'console' }
  },
  categories: {
    default: {
      appenders: ['console'],
      level: 'debug'
    }
  }
});

const logger = log4js.getLogger();

console.log('log4js版本：', log4js.version);
logger.trace('这是trace级别的日志（不会输出，因为级别低于info）');
logger.debug('这是debug级别的日志（不会输出）');
logger.info('这是info级别的日志（会输出）');
logger.warn('这是warn级别的日志（会输出）');
logger.error('这是error级别的日志（会输出）');
logger.fatal('这是fatal级别的日志（会输出）');
