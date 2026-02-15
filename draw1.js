import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

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

  // 连接比特浏览器（替换为你的调试地址）
  const browser = await puppeteer.connect({
    browserWSEndpoint: 'ws://127.0.0.1:57092/devtools/browser/a470b419-277b-4d61-9adb-1e0ae0c571ba',
    defaultViewport: null,
    slowMo: 50
  });
  const page = await browser.newPage();

  // 打印关键指纹信息，验证是否与比特浏览器一致
  const fingerprint = await page.evaluate(() => {
    return {
      webdriver: navigator.webdriver, // 应返回 undefined
      userAgent: navigator.userAgent, // 应等于比特浏览器的UA
      platform: navigator.platform, // 应等于比特浏览器的平台
      hardwareConcurrency: navigator.hardwareConcurrency // 应等于比特浏览器的配置
    };
  });
  console.log('指纹验证结果：', fingerprint);

  // 访问反检测站点，可视化验证
  // await page.goto('https://bot.sannysoft.com/');
  // await sleep(5000)
  // await page.screenshot({ path: 'stealth-verify.png' });
  // const start = Date.now()
  // await page.goto('https://live.douyin.com/912675620433', { waitUntil: 'networkidle2' });
  // await page.goto('https://www.baidu.com');
  await page.goto('https://live.douyin.com/778041341263');
  // console.log(`load elapsed ${Date.now() - start} ms`)
  await randomDelay(3000, 5000)

  // await page.evaluate(() => {
  //   // 抖音特征一键自检
  //   console.log('===== 抖音Chrome特征自检结果 =====');
  //   console.log('1. webdriver:', navigator.webdriver ?? '正常(undefined)');
  //   console.log('2. 存在window.chrome:', !!window.chrome);
  //   console.log('3. 存在chrome.runtime:', !!window.chrome?.runtime);
  //   console.log('4. 插件数量:', navigator.plugins.length);
  //   console.log('5. mimeTypes数量:', navigator.mimeTypes.length);
  //   console.log('6. 语言:', navigator.language);
  //   console.log('==================================');

  //   const checkList = [];
  //   if (navigator.webdriver === true) checkList.push('❌ webdriver=true（高危）');
  //   if (!window.chrome) checkList.push('❌ 无window.chrome');
  //   if (!window.chrome?.runtime) checkList.push('❌ 无chrome.runtime');
  //   if (navigator.plugins.length === 0) checkList.push('❌ 插件为空');
  //   if (navigator.mimeTypes.length === 0) checkList.push('❌ mimeTypes为空');

  //   if (checkList.length === 0) {
  //     console.log('✅ 核心Chrome特征全正常，抖音不会识别为自动化');
  //   } else {
  //     console.log('⚠️ 被检测风险项：', checkList);
  //   }
  // })

  // return

  const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const minX = 1;
  const maxX = (viewport.width || 1920) - 100;
  const minY = 1;
  const maxY = (viewport.height || 1080) - 100;
  console.log(`viewport.width=${viewport.width} viewport.height=${viewport.height}`)
  // 随机起始点、终点
  let start = { x: Math.floor(Math.random() * (maxX - minX)) + minX, y: Math.floor(Math.random() * (maxY - minY)) + minY };
  // const end = { x: Math.floor(Math.random() * (maxX - minX)) + minX, y: Math.floor(Math.random() * (maxY - minY)) + minY };

  let fudaiBounds
  const fudaiSelector = '.LMUtLyr9'
  try {
    await page.waitForSelector(fudaiSelector, { visible: true, timeout: 5000 });
    fudaiBounds = await page.$eval(fudaiSelector, (el) => {
      const rect = el.getBoundingClientRect();
      return {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      }
    });
    console.log('fudaiBounds', fudaiBounds)
  } catch (error) {
    console.log(error)
    return
  }
  let end = calcCentralPoint(fudaiBounds)


  let points = generateBezierCurve(start, end, { width: viewport.width, height: viewport.height })

  // 随机总滑动时间：500-2000ms（单次滑动的总时长）
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    console.log(`move ${i}\t${point.x}\t${point.y}`)
    // 计算移动延迟：起步/收尾延迟高（慢），中间延迟低（快）
    const progress = i / points.length;
    let delayTime = 0;
    if (progress < 0.2 || progress > 0.8) {
      delayTime = 8 + Math.random() * 5; // 起步/收尾：30-40ms（更慢）
    } else {
      delayTime = 2 + Math.random() * 3; // 中间：10-15ms（放慢）
    }
    // 移动到当前轨迹点
    await page.mouse.move(point.x, point.y, { steps: 1, delay: delayTime });
    // await delay(delayTime)
  }
  await page.mouse.click(end.x, end.y, { delay: 50 });


  let particBounds
  const particSelector = '.QOARtY3v.VA93rNkB.WrS6ZBHo[role="button"]'
  try {
    await page.waitForSelector(particSelector, { visible: true, timeout: 5000 });
    particBounds = await page.$eval(particSelector, (el) => {
      const rect = el.getBoundingClientRect();
      return {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      }
    });
    console.log('particBounds', particBounds)
  } catch (error) {
    console.log(error)
    return
  }
  start = end
  end = calcCentralPoint(particBounds)
  points = generateBezierCurve(start, end, { width: viewport.width, height: viewport.height })

  // 随机总滑动时间：500-2000ms（单次滑动的总时长）
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    console.log(`move ${i}\t${point.x}\t${point.y}`)
    // 计算移动延迟：起步/收尾延迟高（慢），中间延迟低（快）
    const progress = i / points.length;
    let delayTime = 0;
    if (progress < 0.2 || progress > 0.8) {
      delayTime = 8 + Math.random() * 5; // 起步/收尾：30-40ms（更慢）
    } else {
      delayTime = 2 + Math.random() * 3; // 中间：10-15ms（放慢）
    }
    // 移动到当前轨迹点
    await page.mouse.move(point.x, point.y, { steps: 1, delay: delayTime });
    // await delay(delayTime)
  }

  // await page.mouse.click(end.x, end.y, { button: 'right', delay: 100 });
  await page.mouse.click(end.x, end.y, { delay: 80 });
  await delay(50);

  //看一下还要倒数多久
  let countdown
  const countdownSelector = '.ycjwPFJI'
  try {
    await page.waitForSelector(countdownSelector, { visible: true, timeout: 5000 });
    const countdownStr = await page.$eval(countdownSelector, (el) => el.innerHTML);
    countdown = parseDuration(countdownStr)
  } catch (error) {
    console.log(error)
    return
  }

  //鼠标移开
  start = end
  end = { x: Math.floor(Math.random() * (maxX - minX)) + minX, y: Math.floor(Math.random() * (maxY - minY)) + minY };
  points = generateBezierCurve(start, end, { width: viewport.width, height: viewport.height }, 25)
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    console.log(`move ${i}\t${point.x}\t${point.y}`)
    // 计算移动延迟：起步/收尾延迟高（慢），中间延迟低（快）
    const progress = i / points.length;
    let delayTime = 0;
    if (progress < 0.2 || progress > 0.8) {
      delayTime = 8 + Math.random() * 5; // 起步/收尾：30-40ms（更慢）
    } else {
      delayTime = 2 + Math.random() * 3; // 中间：10-15ms（放慢）
    }
    // 移动到当前轨迹点
    await page.mouse.move(point.x, point.y, { steps: 1, delay: delayTime });
    // await delay(delayTime)
  }

  //等开奖
  const lotteryCloseSelector = '.KAiGrPfN'
  try {
    await page.waitForSelector(lotteryCloseSelector, { visible: true, timeout: countdown * 1000 });
    const rs = await page.$eval(lotteryCloseSelector, (el) => el.innerHTML);
    console.log(`lottery rs=${rs}`)
  } catch (error) {
    console.log(error)
    return
  }

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
  const offsetRange = 50; // 可调整的偏移范围
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

export const parseDuration = (durationStr) => {
  //05:29
  if (!durationStr) return 0
  const elments = durationStr.trim().split(':')
  console.log(elments)
  let seconds = 0
  for (let i = 0; i < elments.length; i++) {
    seconds += parseInt(elments[i]) * Math.pow(60, elments.length - i - 1)
  }
  return seconds
}



