import { logger } from '../logger/utils.js';

logger.info(`Worker Process start | PID: ${process.pid}`)

process.on('message', (msg) => {
  logger.info('worker received:', msg)
  try {
    const b = {}
    b.test()
  } catch (error) {
    error.message = `here comes the error: ${error.message}`
    logger.error(error)
    const errorObj = {
      name: error.name,    // 错误名称（如Error、TypeError）
      message: error.message, // 错误描述
      stack: error.stack,  // 错误堆栈（便于调试）
      code: error.code     // 可选：Node内置错误的code（如EACCES、ENOENT）
    };
    process.send({ error: errorObj });
  }
});

