import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Bezier } from 'bezier-js';

function sleep(timeout) {
  return new Promise(resolve => {
    setTimeout(resolve, timeout)
  })
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))
const randomNum = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomOffset = (n) => Math.floor(Math.random() * (n * 2 + 1)) - n;
const randomDelay = (min = 500, max = 2000) => new Promise(resolve => setTimeout(resolve, randomNum(min, max)));


// 初始化stealth插件，禁用可能与比特浏览器冲突的指纹修改
const stealth = StealthPlugin({
  // 禁用UA、时区等静态指纹修改（由比特浏览器接管）
  plugins: {
    // 必须保留的核心插件（隐藏自动化特征）
    hideWebdriver: true, // 修复 navigator.webdriver = true 的核心插件
    removeTestIdAttribute: true, // 移除自动化相关的 test-id 属性
    hideChromeRuntime: true, // 修复 window.chrome 异常的特征
    // 禁用与比特浏览器指纹冲突的插件（由比特浏览器接管）
    userAgentOverride: false, // 禁用UA覆盖
    navigatorLanguages: false, // 禁用语言指纹修改
    navigatorPlatform: false, // 禁用平台指纹修改
    navigatorHardwareConcurrency: false, // 禁用CPU核心数修改
    navigatorDeviceMemory: false, // 禁用设备内存修改
    timezoneOverride: false, // 补充：禁用时区修改（避免冲突）
    canvasFingerprintDefender: false, // 补充：禁用Canvas指纹修改（比特浏览器已处理）
    webglFingerprintDefender: false, // 补充：禁用WebGL指纹修改（比特浏览器已处理）
  }
});
puppeteer.use(stealth);

(async () => {
  const browser = await puppeteer.connect({
    browserWSEndpoint: 'ws://127.0.0.1:62018/devtools/browser/c42b6335-9266-46c4-a9e8-935c11f3abc0',
    defaultViewport: null,
    slowMo: 50
  });

  let page = (await browser.pages()).find(p => {
    console.log(p.url())
    return p.url().includes('kleki')
  })
  if (page) {
    await page.bringToFront()
    await page.reload()
  } else {
    page = await browser.newPage();
    await page.goto('https://kleki.com/');
  }

  await page.waitForSelector('canvas', { timeout: 5000 });

  const [minX, minY] = [30, 60];
  const [maxX, maxY] = [1040, 700];
  let start = { x: randomNum(minX, maxX), y: randomNum(minY, maxY) }
  await page.mouse.move(start.x, start.y);
  await page.mouse.click(start.x, start.y, { clickCount: 2, delay: 20 });
  await delay(1000)

  let end
  for (let i = 0; i < 10; i++) {
    await page.mouse.down({ button: 'left' });
    end = { x: randomNum(minX, maxX), y: randomNum(minY, maxY) }
    await humanMove(page, start, end)
    start = end
    await page.mouse.up({ button: 'left' });
  }
})()

const humanMove = async (page, start, end) => {
  const [distance, c1, c2] = getBezierControlPoints(start, end);
  const bezier = new Bezier(start, c1, c2, end);
  // 总步数：20到30步最自然
  const totalSteps = Math.max(20, 30);
  //逐步移动（应用变速+随机抖动）
  for (let step = 0; step < totalSteps; step++) {
    // 计算当前步骤的t值（应用缓动，实现变速）
    const rawT = step / (totalSteps - 1);
    const easedT = easeInOut(rawT);
    // 获取贝塞尔曲线上的基础点
    let { x, y } = bezier.get(easedT);
    // 加入微小坐标抖动（±1~2px），模拟人类手部微小晃动
    x += (Math.random() - 0.5) * 2;
    y += (Math.random() - 0.5) * 2;
    // 移动鼠标到当前点
    await page.mouse.move(x, y);
    // 计算并等待当前步骤的延迟（控制速度）
    const stepDelay = getHumanStepDelay(distance, step, totalSteps);
    await delay(stepDelay)
  }
}

/**
 * 计算人类鼠标移动的每步延迟（延迟越小，速度越快）
 * @param {number} distance 起点到终点的距离（px）
 * @param {number} stepIndex 当前步骤索引（0~totalSteps-1）
 * @param {number} totalSteps 总步数
 * @returns {number} 每步延迟（ms）
 */
function getHumanStepDelay(distance, stepIndex, totalSteps) {
  // 1. 基准延迟：根据距离适配（短距离慢，长距离快）
  let baseDelay;
  if (distance < 100) baseDelay = 12; // 短距离：慢（延迟大）
  else if (distance < 500) baseDelay = 6; // 中等距离：中等速度
  else baseDelay = 2; // 长距离：快（延迟小）

  // 2. 应用缓动（起步/收尾减速，中间加速）
  const t = stepIndex / (totalSteps - 1); // 当前步骤的t值（0~1）
  const easedT = easeInOut(t);
  // 缓动后延迟：起步/收尾延迟=基准*1.5，中间=基准*0.8
  const easedDelay = baseDelay * (1.5 - 0.7 * easedT);

  // 3. 加入微小随机波动（±1~3ms），增加自然感
  const randomOffset = 1 + Math.random() * 2;
  if (Math.random() > 0.5) {
    return easedDelay + randomOffset;
  } else {
    return Math.max(2, easedDelay - randomOffset); // 最小延迟2ms，避免过快
  }
}

/**
 * 给定起点和终点，生成模拟人类鼠标移动的最优三阶贝塞尔控制点
 * @param {Object} start - 起点 {x, y}
 * @param {Object} end - 终点 {x, y}
 * @returns {Object} 包含控制点c1、c2的对象
 */
function getBezierControlPoints(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  // 计算起点到终点的距离
  const distance = Math.sqrt(dx * dx + dy * dy);
  // 动态偏移量：距离的10%~20%，小范围随机增加自然感（非完全随机）
  // const offset = distance * (0.1 + Math.random() * 0.1);
  const offset = distance * (0.05 + Math.random() * 0.05);
  // 生成平缓的控制点（避免大弧度）
  const c1 = {
    x: start.x + dx * 0.3, // 沿连线30%位置
    y: start.y + dy * 0.3 + offset // 轻微向上/下偏移
  };
  const c2 = {
    x: start.x + dx * 0.7, // 沿连线70%位置
    y: start.y + dy * 0.7 + offset // 同方向偏移，保证轨迹平缓
  };

  return [distance, c1, c2];
}

/**
 * 缓动函数（ease-in-out）：实现起步加速、收尾减速
 * @param {number} t 0~1的参数
 * @returns {number} 缓动后的t值
 */
function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
