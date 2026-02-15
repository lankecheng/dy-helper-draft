import { Bezier } from 'bezier-js';
import log4js from 'log4js';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as bb from './request.cjs';

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

// 只开防检测，不动比特指纹（避免冲突）
const stealth = StealthPlugin();
stealth.enabledEvasions.clear();
stealth.enabledEvasions.add('chrome.runtime');
stealth.enabledEvasions.add('navigator.webdriver');
console.log('stealth enabledEvasions', [...stealth.enabledEvasions])
puppeteer.use(stealth);

// 工具函数（逻辑不变）
const randomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))
const randomDelay = (min = 500, max = 2000) => new Promise(resolve => setTimeout(resolve, randomNumber(min, max)));

(async () => {
  try {
    const browserId = 'e2c680ad33054848bf9adf14c341a9d2'
    const alivePids = await bb.getAlivePids([browserId])
    if (browserId in alivePids.data) {
      await bb.closeBrowser(browserId)
      await delay(500)
    }
    const openResp = await bb.openBrowser({
      id: browserId,
      queue: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--remote-debugging-port=0',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-default-browser-check'
      ]
    })
    // 1.连接之
    // const BITTER_WS = 'ws://127.0.0.1:62018/devtools/browser/c42b6335-9266-46c4-a9e8-935c11f3abc0';
    const browser = await puppeteer.connect({
      browserWSEndpoint: openResp.data.ws,
      defaultViewport: null,
      slowMo: 80,
      ignoreDefaultArgs: ['--enable-automation'],
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-setuid-sandbox"
      ]
    });

    // 3.新建页面并配置
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);

    //关闭残留的douyin页面
    const pages2Close = (await browser.pages()).filter(p => {
      console.log(p.url())
      return p.url().includes('douyin')
    })
    if (pages2Close?.length) {
      for (let p of pages2Close) {
        await p.close()
      }
    }

    await page.bringToFront()
    //鼠标先随机出现在显示区域内
    const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
    logger.info('viewport', viewport)
    let start = { x: randomNumber(1, viewport.width), y: randomNumber(1, viewport.height) };
    await page.mouse.move(start.x, start.y);
    await page.goto('https://www.baidu.com');
    return
    //进入直播间
    const userUrl = 'https://www.douyin.com/user/self?from_tab_name=main';
    await page.goto(userUrl);
    await delay(randomNumber(3000, 6000));

    const liveUrl = 'https://live.douyin.com/293309284241'
    await page.goto(liveUrl);
    await delay(randomNumber(6000, 8000));
    logger.info('✅ 已进入直播间');
    // await detect(page)

    //找到福袋的位置
    let fudaiBounds = await withElapsed('get fudai bounds', async () => await getFudaiBoundingClientRect(page))
    logger.info('fudaiBounds', fudaiBounds)
    let end = calcCentralPoint(fudaiBounds)
    logger.info('fudai point', end)
    //移动至福袋
    await withElapsed('move to fudai', async () => await humanMove(page, start, end))
    await randomDelay(20, 50)
    //点击福袋
    await withElapsed('click fudai', async () => await page.mouse.click(end.x, end.y))

    //找到"参与"的位置
    const particBounds = await withElapsed(
      'get partic bounds',
      async () => await getBoundingClientRect(page, '.QOARtY3v.VA93rNkB.WrS6ZBHo[role="button"]')
    )
    logger.info('particBounds', particBounds)
    start = end
    end = calcCentralPoint(particBounds)
    logger.info('partic point', end)
    //移动至“参与”
    await humanMove(page, start, end)
    await randomDelay(20, 50)
    //点击"参与"
    await withElapsed('click partic', async () => await page.mouse.click(end.x, end.y))

    //移到旁边点赞
    // const layoutBounds = await getBoundingClientRect(page, '#LikeLayout')
    // start = end
    // end = {
    //   x: randomNumber(Math.floor(layoutBounds.width / 4 * 3), layoutBounds.width),
    //   y: randomNumber(Math.floor(layoutBounds.height / 8 * 6), Math.floor(layoutBounds.height / 8 * 7))
    // }
    // await humanMove(page, start, end)
    // for (let i = 0; i < 3; i++) {
    //   randomDelay(20, 80)
    //   await page.mouse.click(end.x, end.y);
    // }

    //再次点击“福袋”
    await randomDelay(2000, 3000)
    start = end
    end = calcCentralPoint(fudaiBounds)
    //移动至福袋
    await withElapsed('move to fudai', async () => await humanMove(page, start, end))
    await randomDelay(20, 50)
    //点击福袋
    await withElapsed('click fudai', async () => await page.mouse.click(end.x, end.y))

    //移到别的位置
    start = end
    end = { x: start.x + randomNumber(20, 100), y: start.y + randomNumber(20, 100) }
    await humanMove(page, start, end)
  } catch (error) {
    // ESM 版本建议增加全局错误捕获（生产必备）
    console.error('❌ 脚本执行出错：', error);
    process.exit(1); // 出错后退出进程
  }
})()

const calcCentralPoint = (divBounds) => {
  // 3. 计算中间20%区域的边界范围（核心调整：40%到60%）
  // 水平：左边界 = 原x + 宽度*40%，右边界 = 原x + 宽度*60%（中间20%宽度）
  const middle20XMin = divBounds.x + divBounds.width * 0.4;
  const middle20XMax = divBounds.x + divBounds.width * 0.6;
  // 垂直：上边界 = 原y + 高度*40%，下边界 = 原y + 高度*60%（中间20%高度）
  const middle20YMin = divBounds.y + divBounds.height * 0.4;
  const middle20YMax = divBounds.y + divBounds.height * 0.6;
  // 4. 在中间20%区域内生成随机坐标
  const randomX = middle20XMin + Math.random() * (middle20XMax - middle20XMin);
  const randomY = middle20YMin + Math.random() * (middle20YMax - middle20YMin);

  // 取整：Puppeteer支持浮点数，但取整更贴近真实鼠标的像素坐标
  return { x: Math.round(randomX), y: Math.round(randomY) }
}

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

async function getFudaiBoundingClientRect(page) {
  const fudaiSelector = '.ShortTouchContainer';
  await page.waitForSelector(fudaiSelector, { timeout: 5000 });
  try {
    return await page.$eval(fudaiSelector, (el) => {
      const rect = el.children[2].firstElementChild.getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    });
  } catch (error) {
    error.message = `failed to get bounds for ${fudaiSelector}, ${error.message}`
    throw error
  }
}

async function getBoundingClientRect(page, selector) {
  try {
    await page.waitForSelector(selector, { visible: true, timeout: 5000 });
    return await page.$eval(selector, (el) => {
      const rect = el.getBoundingClientRect();
      return {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      }
    });
  } catch (error) {
    error.message = `failed to get bounds for ${selector}, ${error.message}`
    throw error
  }
}

async function withElapsed(msg, cb) {
  const start = Date.now()
  try {
    logger.info(`${msg}, start`)
    const ret = await cb()
    logger.info(`${msg}, finish, ${(Date.now() - start) / 1000}s`)
    return ret
  } catch (error) {
    logger.info(`${msg}, fail, ${(Date.now() - start) / 1000}s`)
    throw error
  }
}

async function detect(page) {
  await page.evaluate(() => {
    // 抖音特征一键自检
    console.log('===== 抖音Chrome特征自检结果 =====');
    console.log('1. webdriver:', navigator.webdriver ?? '正常(undefined)');
    console.log('2. 存在window.chrome:', !!window.chrome);
    console.log('3. 存在chrome.runtime:', !!window.chrome?.runtime);
    console.log('4. 插件数量:', navigator.plugins.length);
    console.log('5. mimeTypes数量:', navigator.mimeTypes.length);
    console.log('6. 语言:', navigator.language);
    console.log('==================================');

    const checkList = [];
    if (navigator.webdriver === true) checkList.push('❌ webdriver=true（高危）');
    if (!window.chrome) checkList.push('❌ 无window.chrome');
    if (!window.chrome?.runtime) checkList.push('❌ 无chrome.runtime');
    if (navigator.plugins.length === 0) checkList.push('❌ 插件为空');
    if (navigator.mimeTypes.length === 0) checkList.push('❌ mimeTypes为空');

    if (checkList.length === 0) {
      console.log('✅ 核心Chrome特征全正常，抖音不会识别为自动化');
    } else {
      console.log('⚠️ 被检测风险项：', checkList);
    }
  })
}