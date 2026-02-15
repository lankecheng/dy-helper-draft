/**
 * @description nodejs dmeo，仅作为demo使用，连接浏览器后，任何业务请直接查询 puppeteer 或 selenium 文档
 * @description 中文文档：https://doc2.bitbrowser.cn/jiekou/ben-di-fu-wu-zhi-nan.html
 * @description 英文文档：https://doc.bitbrowser.net/api-docs/introduction
 * */

const {
  openBrowser,
  closeBrowser,
  createBrowser,
  deleteBrowser,
  getBrowserDetail,
  addGroup,
  editGroup,
  deleteGroup,
  getGroupDetail,
  getGroupList,
  getBrowserList,
  getPids,
  updatepartial,
  updateBrowserMemark,
  deleteBatchBrowser,
  getBrowserConciseList,
  getAlivePids,
  getAliveBrowsersPids,
  batchUpdateBrowserGroup,
  closeBrowsersBySeqs,
  batchUpdateProxy
} = require('./request')
const puppeteer = require('puppeteer')
// 主程序
main()

async function main() {
  try {
    // 创建窗口
    const config = await createNewBrowser()
    // 打开窗口
    let { id } = config
    const res = await openBrowser({
      id,
      args: [],
      loadExtensions: false,
      extractIp: false
    })

    // 判断是否打开成功，打开成功则连接浏览器
    if (res.success) {
      await connect(res, id)
    } else {
      console.error('浏览器打开失败')
    }
  } catch (err) {
    console.error(err)
  }
}
async function connect(res, id) {
  let wsEndpoint = res.data.ws
  try {
    const browser = await puppeteer.connect({
      browserWSEndpoint: wsEndpoint,
      defaultViewport: null
    })
    // 具体业务代码
    const pages = await browser.pages()
    console.log('pages length ===>>> ', pages.length)
    await sleep(5000)

    const res = await closeBrowser(id)
    if (res.success) {
      console.log('关闭浏览器成功===>', id)
    }
  } catch (err) {
    console.error(err)
  }
}

export function sleep(timeout) {
  return new Promise(resolve => {
    setTimeout(resolve, timeout)
  })
}

// 创建窗口
async function createNewBrowser() {
  try {
    // 注意，完整参数，请参考文档
    const res = await createBrowser({
      groupId: null, // 分组ID，不指定的话，会默认归属到账号的默认API分组
      name: '', // 窗口名称
      remark: '111', // 备注
      proxyMethod: 2, // 代理类型，2自定义代理，3提取IP
      proxyType: 'noproxy', // 自定义代理类型 ['noproxy', 'http', 'https', 'socks5', 'ssh']
      host: '', // 代理主机
      port: '', // 代理端口
      proxyUserName: '', // 代理账号
      proxyPassword: '', // 代理密码
      // 指纹对象，需要随机的值，不填即可，如果需要所有指纹都随机，则只传入 browserFingerPrint: {} 空对象即可
      browserFingerPrint: {
        coreVersion: '112', // 内核版本，默认104，可选92
        ostype: 'PC', // 操作系统平台 PC|Android|IOS
        os: 'Win32' // 为navigator.platform值 Win32 | Linux i686 | Linux armv7l | MacIntel，当ostype设置为IOS时，设置os为iPhone，ostype为Android时，设置为 Linux i686 || Linux armv7l
      }
    })
    return res.data
  } catch (err) {
    console.error(err)
  }
  return null
}

// 修改窗口信息，只传入需要修改的字段，具体参考文档，如下只修改备注，ids 传多个支持批量修改，指纹不需要改时不用传
async function updateBrowser() {
  try {
    const res = await updatepartial({ ids: ['553be1c6dbf9414a83e6c4504922c5a2'], remark: '我是一个备注', browserFingerPrint: {} })
    console.log(res)
  } catch (err) {
    console.error(err)
  }
}
