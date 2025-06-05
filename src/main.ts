import { app, BrowserWindow, Menu, ipcMain, dialog, clipboard, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

// 开发模式下启用热重载
if (process.argv.includes('--dev')) {
    try {
        require('electron-reload')(__dirname, {
            electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
            hardResetMethod: 'exit'
        });
    } catch (error) {
        console.log('electron-reload not available');
    }
}

// 保持对窗口对象的全局引用
let mainWindow: BrowserWindow | null = null;

// 检查是否为便携模式（exe文件旁边是否有 portable 文件）
const isPortableMode = (() => {
    const exePath = process.execPath;
    const exeDir = path.dirname(exePath);
    const portableMarker = path.join(exeDir, 'portable');
    return fs.existsSync(portableMarker);
})();

// 配置目录路径
const getConfigBasePath = () => {
    if (isPortableMode) {
        // 便携模式：数据存储在exe文件同目录下的data文件夹
        const exeDir = path.dirname(process.execPath);
        return path.join(exeDir, 'data');
    } else {
        // 普通模式：数据存储在用户目录
        return app.getPath('userData');
    }
};

const configPath = path.join(getConfigBasePath(), 'logininfo');
const masterPasswordPath = path.join(getConfigBasePath(), 'master.config');

// 确保配置目录存在
function ensureConfigDir(): void {
    const basePath = getConfigBasePath();
    if (!fs.existsSync(basePath)) {
        fs.mkdirSync(basePath, { recursive: true });
    }
    if (!fs.existsSync(configPath)) {
        fs.mkdirSync(configPath, { recursive: true });
    }
    
    // 在开发模式下显示存储模式信息
    if (process.argv.includes('--dev')) {
        console.log(`存储模式: ${isPortableMode ? '便携模式' : '普通模式'}`);
        console.log(`数据目录: ${basePath}`);
    }
}

// 检查主密码是否已设置
function isMasterPasswordSet(): boolean {
    return fs.existsSync(masterPasswordPath);
}

// 保存主密码哈希
function saveMasterPasswordHash(password: string): void {
    // 生成随机 salt
    const salt = crypto.randomBytes(32);
    const hash = crypto.scryptSync(password, salt, 32);
    
    // 保存 salt + hash
    const combined = Buffer.concat([salt, hash]);
    fs.writeFileSync(masterPasswordPath, combined.toString('hex'));
}

// 验证主密码
function verifyMasterPassword(password: string): boolean {
    if (!isMasterPasswordSet()) {
        return false;
    }
    
    const savedData = Buffer.from(fs.readFileSync(masterPasswordPath, 'utf8'), 'hex');
    const salt = savedData.subarray(0, 32);
    const savedHash = savedData.subarray(32);
    
    const inputHash = crypto.scryptSync(password, salt, 32);
    return savedHash.equals(inputHash);
}

// 创建主窗口
function createWindow(): void {
    // 创建浏览器窗口
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, '../assets/icon.png'),
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
        show: false
    });

    // 加载应用的index.html
    if (process.argv.includes('--dev')) {
        // 开发模式下加载RSBuild开发服务器
        mainWindow.loadURL('http://localhost:3000');
        
        // 开发模式下启用渲染进程热重载
        mainWindow.webContents.on('did-frame-finish-load', () => {
            if (process.argv.includes('--dev')) {
                mainWindow?.webContents.once('dom-ready', () => {
                    console.log('Renderer process reloaded');
                });
            }
        });
    } else {
        // 生产模式下加载构建后的文件
        mainWindow.loadFile(path.join(__dirname, '../dist/renderer/index.html'));
    }

    // 当窗口准备好显示时
    mainWindow.once('ready-to-show', () => {
        if (mainWindow) {
            mainWindow.show();
            
            // 开发模式下不自动打开开发者工具
            // 如果需要调试，可以通过菜单 -> 视图 -> 开发者工具 打开
        }
    });

    // 当窗口被关闭时
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // 设置菜单
    createMenu();
}

// 创建应用菜单
function createMenu(): void {
    const template: any[] = [
        {
            label: '文件',
            submenu: [
                {
                    label: '新建登录信息',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.send('menu-new-login');
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: '退出',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: '编辑',
            submenu: [
                { role: 'undo', label: '撤销' },
                { role: 'redo', label: '重做' },
                { type: 'separator' },
                { role: 'cut', label: '剪切' },
                { role: 'copy', label: '复制' },
                { role: 'paste', label: '粘贴' },
                { role: 'selectall', label: '全选' }
            ]
        },
        {
            label: '视图',
            submenu: [
                { role: 'reload', label: '重新加载' },
                { role: 'forceReload', label: '强制重新加载' },
                { role: 'toggleDevTools', label: '开发者工具' },
                { type: 'separator' },
                { role: 'resetZoom', label: '实际大小' },
                { role: 'zoomIn', label: '放大' },
                { role: 'zoomOut', label: '缩小' },
                { type: 'separator' },
                { role: 'togglefullscreen', label: '切换全屏' }
            ]
        },
        {
            label: '帮助',
            submenu: [
                {
                    label: '关于',
                    click: () => {
                        if (mainWindow) {
                            dialog.showMessageBox(mainWindow, {
                                type: 'info',
                                title: '关于',
                                message: 'Copy Login Info',
                                detail: '一个安全的登录信息管理工具\n版本: 1.0.0'
                            });
                        }
                    }
                }
            ]
        }
    ];

    // macOS菜单调整
    if (process.platform === 'darwin') {
        template.unshift({
            label: app.getName(),
            submenu: [
                { role: 'about', label: '关于 ' + app.getName() },
                { type: 'separator' },
                { role: 'services', label: '服务' },
                { type: 'separator' },
                { role: 'hide', label: '隐藏 ' + app.getName() },
                { role: 'hideothers', label: '隐藏其他' },
                { role: 'unhide', label: '显示全部' },
                { type: 'separator' },
                { role: 'quit', label: '退出 ' + app.getName() }
            ]
        });
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// 加密数据
function encryptData(data: any, password: string): any {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(password, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
        encrypted,
        iv: iv.toString('hex')
    };
}

// 解密数据
function decryptData(encryptedData: any, password: string): any {
    try {
        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync(password, 'salt', 32);
        const iv = Buffer.from(encryptedData.iv, 'hex');
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        
        let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return JSON.parse(decrypted);
    } catch (error) {
        throw new Error('解密失败，请检查密码是否正确');
    }
}

// IPC处理程序
ipcMain.handle('save-login-info', async (event, { name, username, password, url, notes, masterPassword }) => {
    try {
        ensureConfigDir();
        
        const loginData = {
            name,
            username,
            password,
            url,
            notes,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const encrypted = encryptData(loginData, masterPassword);
        const filePath = path.join(configPath, `${name}.json`);
        
        fs.writeFileSync(filePath, JSON.stringify(encrypted, null, 2));
        return { success: true, message: '登录信息已保存' };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
});

ipcMain.handle('get-login-info', async (event, { name, masterPassword }) => {
    try {
        const filePath = path.join(configPath, `${name}.json`);
        
        if (!fs.existsSync(filePath)) {
            throw new Error(`登录信息 "${name}" 不存在`);
        }

        const encryptedData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const loginData = decryptData(encryptedData, masterPassword);
        
        return { success: true, data: loginData };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
});

ipcMain.handle('list-login-info', async () => {
    try {
        console.log('主进程: list-login-info 被调用');
        console.log('配置路径:', configPath);
        ensureConfigDir();
        
        const allFiles = fs.readdirSync(configPath);
        console.log('目录中的所有文件:', allFiles);
        
        const files = allFiles
            .filter(file => file.endsWith('.json'))
            .map(file => file.replace('.json', ''));
        
        console.log('过滤后的登录信息文件:', files);
        return { success: true, data: files };
    } catch (error: any) {
        console.error('list-login-info 错误:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('delete-login-info', async (event, name) => {
    try {
        const filePath = path.join(configPath, `${name}.json`);
        
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return { success: true, message: '登录信息已删除' };
        } else {
            throw new Error(`登录信息 "${name}" 不存在`);
        }
    } catch (error: any) {
        return { success: false, message: error.message };
    }
});

ipcMain.handle('copy-to-clipboard', async (event, text) => {
    try {
        clipboard.writeText(text);
        return { success: true, message: '已复制到剪贴板' };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
});

// 在默认浏览器中打开链接
ipcMain.handle('open-external-url', async (event, url) => {
    try {
        await shell.openExternal(url);
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
});

// 检查是否为首次使用（主密码是否已设置）
ipcMain.handle('is-first-time', async () => {
    try {
        return { success: true, isFirstTime: !isMasterPasswordSet() };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
});

// 设置主密码
ipcMain.handle('set-master-password', async (event, password) => {
    try {
        saveMasterPasswordHash(password);
        return { success: true, message: '主密码设置成功' };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
});

// 验证主密码
ipcMain.handle('verify-master-password', async (event, password) => {
    try {
        const isValid = verifyMasterPassword(password);
        return { success: true, isValid };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
});

// 重置应用（删除所有数据和主密码）
ipcMain.handle('reset-app', async () => {
    try {
        // 删除所有登录信息文件
        if (fs.existsSync(configPath)) {
            const files = fs.readdirSync(configPath);
            files.forEach(file => {
                if (file.endsWith('.json')) {
                    fs.unlinkSync(path.join(configPath, file));
                }
            });
        }
        
        // 删除主密码文件
        if (fs.existsSync(masterPasswordPath)) {
            fs.unlinkSync(masterPasswordPath);
        }
        
        return { success: true, message: '应用已重置' };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
});

// 当Electron完成初始化并准备创建浏览器窗口时调用此方法
app.whenReady().then(createWindow);

// 当所有窗口都关闭时退出应用
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
}); 