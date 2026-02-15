import { logger } from '../logger/utils.js';

// 异步处理主进程的message消息（核心：async处理函数）
process.on('message', async (msg) => {
  logger.info(`[开始处理] 消息ID：${msg.id}，内容：${msg.data}`);

  // 模拟异步任务：如await fs.readFile()/await axios.get()
  await new Promise((resolve) => {
    setTimeout(resolve, 1000 * (5 - msg.id)); // 阻塞2秒，模拟异步操作
  });

  // 异步任务完成后，回复主进程
  logger.info(`[处理完成] 消息ID：${msg.id}`);
  process.send({ msg: `消息${msg.id}处理完成（异步任务执行完毕）` });
});