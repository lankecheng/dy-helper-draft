import puppeteer from 'puppeteer'
// import util from 'util'
// import { openBrowser } from './request.js'
// const puppeteer = require('puppeteer');
// const util = require('util');
// const { openBrowser } = require('./request.js');

//const id = 'e2c680ad33054848bf9adf14c341a9d2'
//let res = null
//try {
//  res = await openBrowser({
//    id,
//    args: [],
//    loadExtensions: false
//  })
//} catch (error) {
//  console.log(error)
//  process.exit()
//}

//console.log('openBrowser result', res)

const TARGET_URL = 'https://live.douyin.com'; //抖音直播主站
const CAPTURE_API = 'https://live.douyin.com/webcast/feed'; //要捕获的接口
const VIEWPORT = { width: 1920, height: 1080 }; //浏览器窗口大小，避免元素不可见

try {
  const browser = await puppeteer.connect({
    browserWSEndpoint: 'ws://127.0.0.1:63649/devtools/browser/2f8fdee7-6001-4416-9c55-b1c80745de73',
    defaultViewport: null
  })
  //具体业务代码
  //const pages = await browser.pages()
  //console.log('pages', JSON.stringify(pages, null, 2))
  //console.log('pages', util.inspect(pages, { depth: null, colors: true, spaces: 2 }))
  //console.log('pages length ===>>> ', pages.length)
  //await sleep(5000)

  //const res = await closeBrowser(id)
  //if (res.success) {
  //  console.log('关闭浏览器成功===>', id)
  //}

  //存储捕获到的接口信息
  let captureData = {
    requestHeaders: null, //接口请求头
    cookie: null, //接口Cookie
    xmst: null //localStorage中的xmst
  };

  //2.检测是否已有抖音直播页面
  let targetPage = null;
  const pages = await browser.pages();
  for (const page of pages) {
    const pageUrl = await page.evaluate(() => window.location.href);
    if (pageUrl.startsWith(TARGET_URL)) {
      targetPage = page;
      break;
    }
  }
  //3.无则新建页面打开，有则选中并刷新（避免页面缓存）
  if (!targetPage) {
    targetPage = await browser.newPage();
    //await targetPage.setViewport(VIEWPORT);
    //开启请求拦截，捕获目标接口
    await targetPage.setRequestInterception(true);
    // await targetPage.goto(TARGET_URL, {
    //   waitUntil: 'networkidle2', //网络空闲后再继续，确保页面加载完成
    //   timeout: 30000 //超时时间30秒
    // });
    //4.拦截请求，捕获webcast/feed的请求头和Cookie
    targetPage.on('request', (request) => {
      const requestUrl = request.url();
      //匹配目标接口，仅捕获一次（避免重复请求覆盖数据）
      if (requestUrl.startsWith(CAPTURE_API) && !captureData.requestHeaders) {
        console.log(`Intercepte ${request.url()}`)
        //获取请求头（包含所有自定义和默认表头）
        captureData.requestHeaders = request.headers();
        //获取Cookie（request.cookies()是数组，转成浏览器标准Cookie字符串格式）
        console.log(`request`, request.headers())
        // captureData.cookie = request.cookies().map(item => `${item.name}=${item.value}`).join('; ');
        console.log('✅ 成功捕获webcast/feed请求信息');
      }
      //继续请求，不阻塞页面加载
      request.continue();
    });
    const start = new Date().getTime()
    await targetPage.goto(TARGET_URL, { waitUntil: 'networkidle2' });
    console.log(`open ${TARGET_URL} done, elapsed ${new Date().getTime() - start}`)
  } else {
    await targetPage.bringToFront(); //选中页签
    await targetPage.setRequestInterception(true); //开启请求拦截
    await targetPage.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  }
  //5.下滑页面，触发webcast/feed接口请求（模拟用户操作）
  console.log('🔄 正在下滑页面触发接口请求...');
  // await targetPage.evaluate(() => {
  //   //下滑到页面中部，触发直播流加载（抖音直播滚动加载feed）
  //   console.log('document.body.scrollHeight', document.body.scrollHeight)
  //   window.scrollTo(0, document.body.scrollHeight / 2);
  // });
  // 抖音直播页专属滚动：操作真实的feed流滚动容器，下滑500px（可调整）
  await targetPage.evaluate(() => {
    // 抖音live.douyin.com的feed流滚动容器固定选择器
    const scrollContainer = document.querySelector('.webcast-feed-scroller');
    if (scrollContainer) {
      // 方式1：相对当前位置下滑500px（更贴合用户手动滑动）
      scrollContainer.scrollTop += 500;
      // 方式2：滑到容器中部（和你原逻辑一致），二选一即可
      // scrollContainer.scrollTop = scrollContainer.scrollHeight / 2;
    } else {
      console.warn('未找到抖音滚动容器，尝试默认body滚动');
      window.scrollTo(0, document.body.scrollHeight / 2);
    }
  });
  console.log('✅ 成功下滑页面触发接口请求');
  // //等待接口请求完成（最多等待10秒，避免无限等待）
  // await waitForCapture(captureData, 10000);
  // //6.获取localStorage中的xmst值
  // console.log('🔍 正在获取localStorage.xmst...');
  // captureData.xmst = await targetPage.evaluate(() => {
  //   return window.localStorage.getItem('xmst') || null;
  // });
  // if (!captureData.xmst) {
  //   console.warn('⚠️  localStorage中未找到xmst值');
  // }
  // //7.打印捕获信息
  // console.log('📌 捕获结果预览：', {
  //   xmst: captureData.xmst,
  //   hasApiData: !!captureData.requestHeaders
  // });
} catch (err) {
  console.error(err)
}