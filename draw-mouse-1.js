import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Bezier } from 'bezier-js';

function sleep(timeout) {
  return new Promise(resolve => {
    setTimeout(resolve, timeout)
  })
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))
const getRandomNum = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomOffset = (n) => Math.floor(Math.random() * (n * 2 + 1)) - n;
const randomDelay = (min = 500, max = 2000) => new Promise(resolve => setTimeout(resolve, getRandomNum(min, max)));


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
  const canvasSize = await page.evaluate(() => {
    // 获取第一个canvas元素（可根据id筛选：document.getElementById('your-canvas-id')）
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;

    return {
      // 布局尺寸：页面上显示的实际宽高（受CSS控制）
      layoutWidth: canvas.clientWidth,
      layoutHeight: canvas.clientHeight,
      // 绘制尺寸：canvas画布本身的像素尺寸（绘制区域大小）
      drawWidth: canvas.width,
      drawHeight: canvas.height,
      // 额外：获取CSS样式的宽高（可选）
      cssWidth: getComputedStyle(canvas).width,
      cssHeight: getComputedStyle(canvas).height
    };
  });

  const minX = 30;
  const minY = 160;
  // const maxX = canvasSize.drawWidth;
  // const maxY = canvasSize.drawHeight;
  const maxX = 1040;
  const maxY = 800;

  console.log('canvasSize', canvasSize)
  let start = { x: Math.floor(Math.random() * (maxX - minX)) + minX, y: Math.floor(Math.random() * (maxY - minY)) + minY }
  await page.mouse.move(start.x, start.y);
  await page.mouse.click(start.x, start.y, { clickCount: 2, delay: 20 });
  await delay(1000)

  let end
  for (let i = 0; i < 10; i++) {
    // 随机起始点、终点
    // start = end ?? { x: Math.floor(Math.random() * (maxX - minX)) + minX, y: Math.floor(Math.random() * (maxY - minY)) + minY };
    end = { x: Math.floor(Math.random() * (maxX - minX)) + minX, y: Math.floor(Math.random() * (maxY - minY)) + minY };
    console.log('start', start)
    console.log('end', end)
    console.log('----------')
    // let points = generateBezierCurve(start, end, { width: canvasSize.drawWidth, height: canvasSize.drawHeight })
    const [c1, c2] = getBezierControlPoints(start, end);
    const bezier = new Bezier(start, c1, c2, end);

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    // 总步数：至少30步（短距离），长距离按比例增加（最多100步）
    // const totalSteps = Math.min(30, Math.max(15, Math.floor(distance / 5)));
    const totalSteps = Math.max(20, 30);
    console.log(`Math.floor(distance / 5)=${Math.floor(distance / 5)}, totalSteps=${totalSteps}`)
    // 3. 逐步移动（应用变速+随机抖动）
    await page.mouse.down({ button: 'left' })
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
      await new Promise(resolve => setTimeout(resolve, stepDelay));
    }
    await page.mouse.up({ button: 'left' });

    // const steps = 50; // 分50步移动
    // await page.mouse.down({ button: 'left' })
    // for (let i = 0; i <= steps; i++) {
    //   const t = i / steps;
    //   const point = bezier.get(t);
    //   await page.mouse.move(point.x, point.y);
    //   await new Promise(resolve => setTimeout(resolve, 10)); // 放慢速度
    // }
    // await page.mouse.up({ button: 'left' });
    start = end

    // let points = generateBezierCurve(start, end, { width: maxX - minX, height: maxY - minY })

    // 随机总滑动时间：500-2000ms（单次滑动的总时长）
    // await page.mouse.down({ button: 'left' })
    // for (let i = 0; i < points.length; i++) {
    //   const point = points[i];
    //   console.log(`move ${i}\t${point.x}\t${point.y}`)
    //   // 计算移动延迟：起步/收尾延迟高（慢），中间延迟低（快）
    //   const progress = i / points.length;
    //   let delayTime = 0;
    //   if (progress < 0.2 || progress > 0.8) {
    //     delayTime = 8 + Math.random() * 5; // 起步/收尾：30-40ms（更慢）
    //   } else {
    //     delayTime = 2 + Math.random() * 3; // 中间：10-15ms（放慢）
    //   }
    //   // 移动到当前轨迹点
    //   await page.mouse.move(point.x, point.y, { steps: 1, delay: delayTime });
    //   // await page.evaluate((x, y) => { window.updateMousePosition(x, y) }, point.x, point.y)
    // }
    // await page.mouse.up({ button: 'left' });
    await randomDelay(1000, 2000)
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


  // const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
  // const minX = 1;
  // const maxX = viewport.width;
  // const minY = 1;
  // const maxY = viewport.height;
  // console.log(`viewport.width=${viewport.width} viewport.height=${viewport.height}`)
  // // 随机起始点、终点
  // let start = { x: Math.floor(Math.random() * (maxX - minX)) + minX, y: Math.floor(Math.random() * (maxY - minY)) + minY };
  // let end = { x: Math.floor(Math.random() * (maxX - minX)) + minX, y: Math.floor(Math.random() * (maxY - minY)) + minY };
  // let points = generateBezierCurve(start, end, { width: viewport.width, height: viewport.height })

  // // 随机总滑动时间：500-2000ms（单次滑动的总时长）
  // await page.mouse.down({ button: 'left' })
  // for (let i = 0; i < points.length; i++) {
  //   const point = points[i];
  //   console.log(`move ${i}\t${point.x}\t${point.y}`)
  //   // 计算移动延迟：起步/收尾延迟高（慢），中间延迟低（快）
  //   const progress = i / points.length;
  //   let delayTime = 0;
  //   if (progress < 0.2 || progress > 0.8) {
  //     delayTime = 8 + Math.random() * 5; // 起步/收尾：30-40ms（更慢）
  //   } else {
  //     delayTime = 2 + Math.random() * 3; // 中间：10-15ms（放慢）
  //   }
  //   // 移动到当前轨迹点
  //   await page.mouse.move(point.x, point.y, { steps: 1, delay: delayTime });
  //   // await page.evaluate((x, y) => { window.updateMousePosition(x, y) }, point.x, point.y)
  // }
  // await page.mouse.up({ button: 'left' });
})();

function generateBezierCurve(start, end, boundingRect, pointCount = 30) {
  // 1.基础控制点（起止点连线上的随机点）
  const cp1 = {
    x: start.x + (end.x - start.x) * Math.random(),
    y: start.y + (end.y - start.y) * Math.random()
  }
  const cp2 = {
    x: start.x + (end.x - start.x) * Math.random(),
    y: start.y + (end.y - start.y) * Math.random()
  }
  // 2.加可控偏移（±50px，且限制在屏幕合理范围）
  // 没有偏移量, 轨迹会无限接近直线, 只是轻微弯曲
  const offsetRange = 20; // 可调整的偏移范围
  cp1.x = Math.max(0, Math.min(boundingRect.width, cp1.x + (Math.random() - 0.5) * offsetRange));
  cp1.y = Math.max(0, Math.min(boundingRect.height, cp1.y + (Math.random() - 0.5) * offsetRange));
  cp2.x = Math.max(0, Math.min(boundingRect.width, cp2.x + (Math.random() - 0.5) * offsetRange));
  cp2.y = Math.max(0, Math.min(boundingRect.height, cp2.y + (Math.random() - 0.5) * offsetRange));

  // 3.贝塞尔曲线公式生成轨迹点
  const points = [];
  for (let t = 0; t <= 1; t += 1 / pointCount) {
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const x = mt3 * start.x + 3 * mt2 * t * cp1.x + 3 * mt * t2 * cp2.x + t3 * end.x;
    const y = mt3 * start.y + 3 * mt2 * t * cp1.y + 3 * mt * t2 * cp2.y + t3 * end.y;
    points.push({ x: Math.round(x), y: Math.round(y) });
  }
  points.push({ x: end.x, y: end.y });
  return points;
}

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

  return [c1, c2];
}
