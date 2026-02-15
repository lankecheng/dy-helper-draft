import { logger, isChildProcess } from "./utils.js";
import { fork } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

// const isChildProcess = !!process.send;
console.log(`master isChildProcess=${isChildProcess}`)

logger.info(`Main Process start | PID: ${process.pid}`)
const worker_filepath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'worker-process.js')
const worker1 = fork(worker_filepath, ['worker-A']);
const worker2 = fork(worker_filepath, ['worker-B']);

worker1.on('message', (msg) => {
  logger.info(`【主进程接收】从${msg.workerName}收到：`, msg.data);
});
// 2. 监听子进程退出，可选重启
worker1.on('exit', (code, signal) => {
  logger.warn(`【子进程退出】${worker1.pid} | 退出码:${code} | 信号:${signal}`);
  // 可选：退出后重启子进程
  // fork(path.join(__dirname, 'worker.js'), ['工作进程-1']);
});
// 3. 监听子进程错误
worker1.on('error', (err) => {
  logger.error(`【子进程错误】${worker1.pid} | 错误:`, err);
});


// 主进程主动给子进程发消息（通信示例）
setTimeout(() => {
  worker1.send({ type: 'task', data: '执行定时任务' });
}, 3000);