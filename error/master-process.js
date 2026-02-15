import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../logger/utils.js';

logger.info(`Main Process start | PID: ${process.pid}`)

const worker = fork(path.join(path.dirname(fileURLToPath(import.meta.url)), 'worker-process.js'));
worker.on('message', (msg) => {
  logger.info(`【主进程接收】从子进程收到：`, msg);
  const error = new Error(msg.error.message);
  error.name = msg.error.name;
  error.stack = msg.error.stack;
  logger.error(error)
});

worker.on('exit', (code, signal) => {
  logger.warn(`【子进程退出】${worker.pid} | 退出码:${code} | 信号:${signal}`);
});
worker.on('error', (err) => {
  logger.error(`【子进程错误】${worker.pid} | 错误:`, err);
});

// 主进程主动给子进程发消息（通信示例）
setTimeout(() => {
  worker.send({ type: 'task', data: '执行定时任务' });
}, 3000);