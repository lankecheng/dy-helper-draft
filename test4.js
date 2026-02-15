import puppeteer from 'puppeteer'
import { openBrowser } from './request.js'

//const TARGET_URL = 'https://www.bilibili.com'
const PAGE_URL_LIVE = 'https://live.douyin.com'; //抖音直播主站
const API_URL_FEED = 'https://live.douyin.com/webcast/feed/'
const API_URL_ME = 'https://live.douyin.com/webcast/user/me/'
const CONTAINER_ID = '#_douyin_live_scroll_container_'

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))
const getRandomNum = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomDelay = (min = 500, max = 2000) => new Promise(resolve => setTimeout(resolve, getRandomNum(min, max)));

//反检测核心函数：封装所有Puppeteer特征屏蔽逻辑
async function antiDetectConfig(page) {
  //核心中的核心：屏蔽 Puppeteer 最关键的 webdriver 特征（可视化模式也必须留）
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    //清理 Puppeteer 专属的全局变量（可视化模式仍会存在，需删除）
    delete window.__puppeteer_evaluation_script__;
  });
  await page.setCacheEnabled(true); //启用缓存，贴合真人浏览器
}

async function findPage(_browser, targetUrl) {
  const [targetUrl1, targetUrl2] = targetUrl.endsWith('/')
    ? [targetUrl.substring(0, targetUrl.length - 1), targetUrl]
    : [targetUrl, `${targetUrl}/`]
  for (const p of await _browser.pages()) {
    const pageUrl = await p.evaluate(() => window.location.href);
    if (pageUrl === targetUrl1 || pageUrl === targetUrl2) {
      return p
    }
  }
  return undefined
}

/**
 * 解析URL查询参数为Map对象
 * @param {string} url 待解析的URL字符串
 * @returns {Map<string, string>} 解析后的参数Map（键=参数名，值=参数值，已解码）
 */
function parseUrlParamsToMap(url) {
  const paramsStr = url.split('?')[1] || '';
  const paramsArr = paramsStr.split('&');
  const paramsMap = new Map();
  paramsArr.forEach(item => {
    // 按=分割键和值，maxSplit=1避免值中包含=的情况（如token）
    const [key, value = ''] = item.split('=', 1);
    // 过滤空键（如&结尾导致的空项）
    if (key) {
      paramsMap.set(key, decodeURIComponent(value));
    }
  });
  return paramsMap;
}

function buildUrl(url, defaultParams, actualParams) {
  const paramsStr = Array.from(defaultParams, ([key, value]) => {
    const actualValue = actualParams.get(key)
    return `${encodeURIComponent(key)}=${encodeURIComponent(actualValue ? actualValue : value)}`
  }).join('&'); // 用&连接所有键
  return `${url}?${paramsStr}`
}

function simpleInterceptRequest(page) {
  page.on('request', request => {
    console.log(`>${request.url()}`)
  })
}

function simpleInterceptResponse(page, baseUrl) {
  page.on('response', (response) => {
    console.log(`<${response.url()}`)
    // if (response.url().startsWith(API_URL_ME)) {
    //   console.log('response.request().headers()', response.request().headers())
    // }
  })
}

function interceptRequest(page, baseUrl, rs) {
  page.on('request', request => {
    const requestUrl = request.url()
    if (requestUrl.startsWith(baseUrl)) {
      rs.url = requestUrl
      rs.headers = request.headers()
    }
  })
}

function interceptResponse(page, baseUrl, rs) {
  page.on('response', async (response) => {
    const url = response.url()
    if (url.startsWith(baseUrl)) {
      console.log(`捕获目标接口：${url}`);
      // 解析JSON响应（接口常用）
      const responseData = await response.json();
      rs.userData = responseData;
    }
  })
}

// const id = 'e2c680ad33054848bf9adf14c341a9d2' //5 - 用户3663746679451
const id = '080ec903cf7e4531aef8e37bf392028c' //1 - 1205猪
// const id = 'dcf763e52fe642f1a6b0c862c1d2de5d' //test1
// const id = '89531bdba0e1462db4157a2e3a81f4ba' //test3
let res = await openBrowser({
  id,
  args: [
    '--disable-blink-features=AutomationControlled', //反检测核心, 禁用Chrome自动化控制特征
    '--no-first-run', //禁用首次运行提示
    '--no-default-browser-check', //禁用默认浏览器检查,
    // '--disable-images', // 关闭图片加载（大幅减少请求量，可选）
    // '--disable-media-stream', // 关闭非核心媒体流（可选）
  ],
  loadExtensions: false,
})
console.log('------------------------------------------------')
console.log(res)
console.log('------------------------------------------------')
if (res && res.success) {
  console.log('open successfully')
}

const browser = await puppeteer.connect({
  browserWSEndpoint: res.data.ws,
  headless: 'new',
  defaultViewport: null, //禁用默认视口，使用比特浏览器的原生窗口大小（更真实）
  ignoreHTTPSErrors: true, //忽略HTTPS错误（避免证书问题阻塞访问）
  slowMo: 100, //放慢操作速度（50ms），模拟真人点击/输入
})

let pages = await browser.pages() ?? [];
console.log('当前页面数', pages.length)
pages.forEach(p => antiDetectConfig(p))

const rs = {}

async function interceptFeedRequest(_browser) {
  let page = await findPage(_browser, PAGE_URL_LIVE);
  let [requestPromise, responsePromise] = [null, null]
  if (page) {
    await page.bringToFront();
    // simpleInterceptRequest(page)
    // simpleInterceptResponse(page)
    // interceptRequest(page, API_URL_ME, rs)
    // interceptResponse(page, API_URL_ME, rs)
    await page.reload({ waitUntil: 'networkidle2' });
  } else {
    page = await _browser.newPage();
    await antiDetectConfig(page);
    simpleInterceptRequest(page)
    // simpleInterceptResponse(page)
    // interceptRequest(page, API_URL_ME, rs)
    // interceptResponse(page, API_URL_ME, rs)
    await page.goto(PAGE_URL_LIVE, { waitUntil: 'networkidle2' });
  }

  // new Promise(async (reslove, reject) => {
  //   while (true) {
  //     console.log('rs', rs)
  //     await delay(1000)
  //   }
  // })

  // const params = parseUrlParamsToMap(req ? req.url : '')
  // params.delete('msToken')
  // params.delete('a_bogus')

  // const res = responsePromise ? await responsePromise : null
  // console.log('res', res)
  // return { params, headers: req ? req.headers : null }
}

const feedRequestInfo = {
  url: 'https://live.douyin.com/webcast/feed/',
  params: new Map([
    ['aid', '6383'],
    ['app_name', 'douyin_web'],
    ['live_id', '1'],
    ['device_platform', 'web'],
    ['language', 'zh-CN'],
    ['enter_from', 'link_share'],
    ['cookie_enabled', 'true'],
    ['screen_width', '1470'],
    ['screen_height', '956'],
    ['browser_language', 'zh-CN'],
    ['browser_platform', 'Win32'],
    ['browser_name', 'Chrome'],
    ['browser_version', '140.0.0.0'],
    ['channel', 'channel_pc_web'],
    ['request_tag_from', 'web'],
    ['need_map', '1'],
    ['liveid', '1'],
    ['is_draw', '1'],
    ['inner_from_drawer', '0'],
    ['custom_count', '8'],
    ['action', 'load_more'],
    ['action_type', 'loadmore'],
    ['enter_source', 'web_homepage_hot_web_live_card'],
    ['source_key', 'web_homepage_hot_web_live_card'],
  ])
}

await interceptFeedRequest(browser)
// const { params, headers } = await interceptFeedRequest(browser)

// const feedRequestUrl = buildUrl(feedRequestInfo.url, feedRequestInfo.params, params)
// console.log(feedRequestUrl)



// console.log('finalResult', finalResult)
