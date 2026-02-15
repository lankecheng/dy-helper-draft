import { logger, isChildProcess } from "./utils.js";

const [workerName] = process.argv.slice(2) || '未知子进程';

// const isChildProcess = !!process.send;
console.log(`${workerName} isChildProcess=${isChildProcess}`)
logger.info(`worker process ${workerName} start|PID: ${process.pid}`)

setInterval(() => {
  logger.debug(`【${workerName}】调试日志 | 随机数:`, Math.random().toFixed(2));
  logger.info(`【${workerName}】业务日志 | 正常执行`);
}, 1000);

setInterval(() => {
  process.send({
    workerName,
    data: `当前PID:${process.pid}，运行正常`
  });
}, 2000);

// 监听主进程发来的消息（通信示例）
process.on('message', (msg) => {
  if (msg.type === 'task') {
    logger.warn(`【${workerName}】收到主进程任务 | 内容:`, msg.data);
  }
});