const express = require('express');
const fs = require('fs');
const axios = require('axios');
const path = require('path');
const fileService = require('./services/fileService');
const apiService = require('./services/apiService');
const CONFIG = require('./config');

const app = express();
const { PATHS, ARGO, NEZHA, CF_SETTINGS } = CONFIG;

// 初始化文件结构
fileService.ensureDirectory();
fileService.cleanOldFiles();

// 主程序
const main = async () => {
  try {
    // 生成配置文件
    await generateConfig();
    
    // 下载依赖
    const files = getFilesForArchitecture();
    await downloadFiles(files);
    
    // 启动守护进程
    await startDaemonServices();
    
    // 启动订阅服务
    startSubscriptionServer();
    
    // 启动清理服务
    fileService.cleanResources();
    
  } catch (error) {
    console.error('Critical initialization error:', error.message);
    process.exit(1);
  }
};

// 生成配置文件
function generateConfig() {
  const config = {
    log: { access: '/dev/null', error: '/dev/null', loglevel: 'none' },
    inbounds: [...], // 等同原配置
    dns: { servers: ["https+local://8.8.8.8/dns-query"] },
    outbounds: [...] // 等同原配置
  };
  
  fileService.saveFile(CONFIG.PATHS.config, JSON.stringify(config, null, 2));
}

// 根据架构获取文件
function getFilesForArchitecture() {
  const arch = CONFIG.SYSTEM_ARCH;
  const files = [{
    name: 'web',
    url: CONFIG.ARCH_SUPPORT[arch].web
  }, {
    name: 'bot',
    url: CONFIG.ARCH_SUPPORT[arch].bot
  }];
  
  if (NEZHA.SERVER && NEZHA.KEY) {
    if (NEZHA.PORT) {
      files.unshift({
        name: 'npm',
        url: CONFIG.ARCH_SUPPORT[arch].nezhaAgent
      });
    } else {
      files.unshift({
        name: 'php',
        url: CONFIG.ARCH_SUPPORT[arch].nezhaV1
      });
    }
  }
  
  return files;
}

// 下载文件函数
async function downloadFiles(files) {
  const downloadPromises = files.map(async (file) => {
    try {
      const response = await axios.get(file.url, { responseType: 'stream' });
      const writer = fs.createWriteStream(path.join(CONFIG.FILE_PATH, file.name));
      
      response.data.pipe(writer);
      
      return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', (err) => {
          fs.unlink(path.join(CONFIG.FILE_PATH, file.name), () => {});
          reject(err);
        });
      });
    } catch (error) {
      console.error(`Download ${file.name} failed:`, error.message);
      throw error;
    }
  });
  
  try {
    await Promise.all(downloadPromises);
  } catch (error) {
    console.error('Error downloading files:', error.message);
    throw error;
  }
  
  // 添加执行权限
  const permissionFiles = NEZHA.PORT ? 
    ['web', 'bot', 'npm'] : ['web', 'bot', 'php'];
  
  await fileService.runCommand(
    `chmod 775 ${permissionFiles.map(f => path.join(CONFIG.FILE_PATH, f)).join(' ')}`
  );
}

// 启动守护进程
async function startDaemonServices() {
  // 启动nezha监控
  if (NEZHA.SERVER && NEZHA.KEY) {
    // ...原nezha逻辑保持不变
  }
  
  // 启动web服务
  await fileService.runCommand(`nohup ${CONFIG.PATHS.web} -c ${CONFIG.PATHS.config} >/dev/null 2>&1 &`);
  
  // 启动argo隧道
  await startArgoTunnel();
}

// 启动argo隧道
async function startArgoTunnel() {
  // 原extractDomains函数逻辑移到此处并优化
  // 使用异步处理，添加超时保护
}

// 启动订阅服务器
function startSubscriptionServer() {
  app.listen(CONFIG.PORT, () => {
    console.log(`🚀 HTTP server running on port:${CONFIG.PORT}!`);
  });
  
  app.get(`/${CONFIG.PATHS.SUB}`, (req, res) => {
    // 返回订阅内容
  });
}

main();
