import { contextBridge, ipcRenderer } from 'electron';

// 定义API接口
interface ElectronAPI {
    saveLoginInfo: (data: any) => Promise<any>;
    getLoginInfo: (data: any) => Promise<any>;
    listLoginInfo: () => Promise<any>;
    deleteLoginInfo: (name: string) => Promise<any>;
    copyToClipboard: (text: string) => Promise<any>;
    openExternalUrl: (url: string) => Promise<any>;
    isFirstTime: () => Promise<any>;
    setMasterPassword: (password: string) => Promise<any>;
    verifyMasterPassword: (password: string) => Promise<any>;
    resetApp: () => Promise<any>;
    onMenuNewLogin: (callback: () => void) => void;
    removeAllListeners: (channel: string) => void;
}

// 暴露安全的API给渲染进程
const electronAPI: ElectronAPI = {
    // 保存登录信息
    saveLoginInfo: (data: any) => ipcRenderer.invoke('save-login-info', data),
    
    // 获取登录信息
    getLoginInfo: (data: any) => ipcRenderer.invoke('get-login-info', data),
    
    // 列出所有登录信息
    listLoginInfo: () => ipcRenderer.invoke('list-login-info'),
    
    // 删除登录信息
    deleteLoginInfo: (name: string) => ipcRenderer.invoke('delete-login-info', name),
    
    // 复制到剪贴板
    copyToClipboard: (text: string) => ipcRenderer.invoke('copy-to-clipboard', text),
    
    // 在默认浏览器中打开链接
    openExternalUrl: (url: string) => ipcRenderer.invoke('open-external-url', url),
    
    // 检查是否为首次使用
    isFirstTime: () => ipcRenderer.invoke('is-first-time'),
    
    // 设置主密码
    setMasterPassword: (password: string) => ipcRenderer.invoke('set-master-password', password),
    
    // 验证主密码
    verifyMasterPassword: (password: string) => ipcRenderer.invoke('verify-master-password', password),
    
    // 重置应用
    resetApp: () => ipcRenderer.invoke('reset-app'),
    
    // 监听菜单事件
    onMenuNewLogin: (callback: () => void) => {
        ipcRenderer.on('menu-new-login', callback);
    },
    
    // 移除监听器
    removeAllListeners: (channel: string) => {
        ipcRenderer.removeAllListeners(channel);
    }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// 声明全局类型
declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
} 