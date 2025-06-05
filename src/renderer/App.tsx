import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Card, List, Form, Input, Modal, message, Space, Typography, Descriptions, Popconfirm, Alert } from 'antd';
import { PlusOutlined, CopyOutlined, EditOutlined, DeleteOutlined, EyeOutlined, EyeInvisibleOutlined, LockOutlined, UnlockOutlined, LogoutOutlined, ReloadOutlined } from '@ant-design/icons';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

interface LoginInfo {
  name: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface LoginFormData {
  name: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
}

const App: React.FC = () => {
  // 应用级别的状态
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [showMasterPasswordModal, setShowMasterPasswordModal] = useState(true);
  const [isFirstTime, setIsFirstTime] = useState(true); // 是否首次使用
  
  // 数据状态
  const [loginList, setLoginList] = useState<string[]>([]);
  const [selectedLogin, setSelectedLogin] = useState<string | null>(null);
  const [currentLoginData, setCurrentLoginData] = useState<LoginInfo | null>(null);
  
  // UI状态
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  
  // 表单
  const [form] = Form.useForm();
  const [masterPasswordForm] = Form.useForm();

  // 加载登录信息列表
  const loadLoginList = async () => {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.listLoginInfo();
        console.log('loadLoginList result:', result); // 调试日志
        if (result.success) {
          setLoginList(result.data);
          console.log('设置 loginList:', result.data); // 调试日志
        } else {
          message.error(result.message);
          setLoginList([]);
        }
      } else {
        message.error('ElectronAPI不可用');
      }
    } catch (error) {
      console.error('加载登录信息列表失败:', error); // 调试日志
      message.error('加载登录信息列表失败');
      setLoginList([]);
    }
  };

  // 验证主密码并解锁应用
  const handleMasterPasswordSubmit = async () => {
    try {
      const values = await masterPasswordForm.validateFields();
      const inputPassword = values.masterPassword;
      
      console.log('handleMasterPasswordSubmit - isFirstTime:', isFirstTime);
      
      if (isFirstTime) {
        // 首次使用，设置主密码
        const setResult = await window.electronAPI.setMasterPassword(inputPassword);
        if (setResult.success) {
          setMasterPassword(inputPassword);
          setIsUnlocked(true);
          setIsFirstTime(false); // 设置成功后不再是首次使用
          setShowMasterPasswordModal(false);
          masterPasswordForm.resetFields();
          message.success('主密码设置成功！');
        } else {
          message.error(setResult.message || '设置主密码失败');
        }
      } else {
        // 验证已存在的主密码
        const verifyResult = await window.electronAPI.verifyMasterPassword(inputPassword);
        if (verifyResult.success && verifyResult.isValid) {
          setMasterPassword(inputPassword);
          setIsUnlocked(true);
          setShowMasterPasswordModal(false);
          masterPasswordForm.resetFields();
          message.success('解锁成功！');
        } else {
          message.error('主密码错误，请重试');
          masterPasswordForm.setFields([
            {
              name: 'masterPassword',
              errors: ['密码错误']
            }
          ]);
        }
      }
      
    } catch (error) {
      console.error('主密码处理失败:', error);
      message.error('操作失败，请重试');
    }
  };

  // 锁定应用
  const lockApp = () => {
    console.log('锁定前 - loginList:', loginList, 'isFirstTime:', isFirstTime); // 调试日志
    setIsUnlocked(false);
    setMasterPassword('');
    setCurrentLoginData(null);
    setSelectedLogin(null);
    setShowMasterPasswordModal(true);
    message.info('应用已锁定');
    console.log('锁定后 - loginList:', loginList, 'isFirstTime:', isFirstTime); // 调试日志
  };

  // 重置应用（清空所有数据）
  const resetApp = async () => {
    try {
      // 调用主进程的重置功能（删除所有登录信息和主密码）
      const result = await window.electronAPI.resetApp();
      
      if (result.success) {
        // 重置前端状态
        setIsUnlocked(false);
        setMasterPassword('');
        setCurrentLoginData(null);
        setSelectedLogin(null);
        setLoginList([]);
        setIsFirstTime(true);
        setShowMasterPasswordModal(true);
        setShowResetConfirm(false);
        
        message.success('应用已重置，所有数据已清空');
      } else {
        message.error(result.message || '重置失败');
      }
    } catch (error) {
      console.error('重置失败:', error);
      message.error('重置失败');
    }
  };

  // 检查是否为首次使用
  const checkFirstTime = async () => {
    try {
      const result = await window.electronAPI.isFirstTime();
      if (result.success) {
        console.log('检查首次使用结果:', result.isFirstTime);
        setIsFirstTime(result.isFirstTime);
      }
    } catch (error) {
      console.error('检查首次使用失败:', error);
    }
  };

  // 初始化
  useEffect(() => {
    console.log('初始化 useEffect 执行');
    checkFirstTime(); // 检查是否为首次使用
    loadLoginList();
    
    // 监听菜单事件
    if (window.electronAPI) {
      window.electronAPI.onMenuNewLogin(() => {
        if (isUnlocked) {
          showNewLoginForm();
        } else {
          message.warning('请先解锁应用');
        }
      });

      return () => {
        window.electronAPI.removeAllListeners('menu-new-login');
      };
    }
  }, []);

  // 解锁后重新加载登录列表
  useEffect(() => {
    if (isUnlocked) {
      console.log('解锁后重新加载登录列表');
      loadLoginList();
    }
  }, [isUnlocked]);

  // 显示新建表单
  const showNewLoginForm = () => {
    setIsFormVisible(true);
    setIsEditing(false);
    setCurrentLoginData(null);
    form.resetFields();
  };

  // 显示编辑表单
  const showEditForm = () => {
    if (!currentLoginData) return;
    setIsFormVisible(true);
    setIsEditing(true);
    form.setFieldsValue({
      name: currentLoginData.name,
      username: currentLoginData.username,
      password: currentLoginData.password,
      url: currentLoginData.url,
      notes: currentLoginData.notes,
    });
  };

  // 选择登录项并加载数据
  const selectLoginItem = async (name: string) => {
    if (!isUnlocked) {
      message.warning('请先解锁应用');
      return;
    }
    
    try {
      setSelectedLogin(name);
      const result = await window.electronAPI.getLoginInfo({ 
        name, 
        masterPassword 
      });
      
      if (result.success) {
        setCurrentLoginData(result.data);
        setShowPassword(false);
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('加载登录信息失败');
    }
  };

  // 处理表单提交
  const handleFormSubmit = async (values: LoginFormData) => {
    try {
      const result = await window.electronAPI.saveLoginInfo({
        ...values,
        masterPassword
      });
      
      if (result.success) {
        message.success(result.message);
        await loadLoginList(); // 重新加载列表
        setIsFormVisible(false);
        form.resetFields();
        
        // 如果是编辑模式，更新当前数据
        if (isEditing && currentLoginData) {
          setCurrentLoginData({ ...currentLoginData, ...values });
        }
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('保存失败');
    }
  };

  // 复制文本到剪贴板
  const copyToClipboard = async (text: string, label: string) => {
    try {
      const copyResult = await window.electronAPI.copyToClipboard(text);
      if (copyResult.success) {
        message.success(`${label}已复制到剪贴板`);
      } else {
        message.error(copyResult.message);
      }
    } catch (error) {
      message.error('复制失败');
    }
  };

  // 在默认浏览器中打开链接
  const openExternalUrl = async (url: string) => {
    try {
      const result = await window.electronAPI.openExternalUrl(url);
      if (!result.success) {
        message.error(result.message || '打开链接失败');
      }
    } catch (error) {
      message.error('打开链接失败');
    }
  };

  // 删除登录信息
  const deleteLogin = async () => {
    if (!selectedLogin) return;
    
    try {
      const result = await window.electronAPI.deleteLoginInfo(selectedLogin);
      if (result.success) {
        message.success(result.message);
        await loadLoginList();
        setCurrentLoginData(null);
        setSelectedLogin(null);
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  // 调试信息显示（可选）
  // console.log('当前状态 - isUnlocked:', isUnlocked, 'isFirstTime:', isFirstTime, 'loginList:', loginList);

  // 如果应用被锁定，显示解锁界面
  if (!isUnlocked) {
    return (
      <Layout style={{ height: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          padding: '20px'
        }}>
          <Card style={{ width: 400, textAlign: 'center' }}>
            <div style={{ marginBottom: '24px' }}>
              <LockOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
              <Title level={2}>Copy Login Info</Title>
              <Text type="secondary">
                {isFirstTime ? '请设置主密码' : '请输入主密码解锁应用'}
              </Text>
              {/* 调试信息 */}
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>
                调试: isFirstTime={isFirstTime.toString()}, loginList长度={loginList.length}
              </div>
            </div>
            
            {isFirstTime && (
              <Alert 
                message="首次使用" 
                description="请设置一个主密码，用于加密保护您的所有登录信息。请牢记此密码，忘记后无法恢复数据。" 
                type="info" 
                style={{ marginBottom: '16px' }}
              />
            )}
            
            <Form form={masterPasswordForm} onFinish={handleMasterPasswordSubmit}>
              <Form.Item
                name="masterPassword"
                rules={[
                  { required: true, message: '请输入主密码' },
                  isFirstTime ? { min: 6, message: '主密码至少6位' } : {}
                ]}
              >
                <Input.Password 
                  placeholder={isFirstTime ? "设置主密码（至少6位）" : "输入主密码"}
                  size="large"
                  autoFocus
                />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" size="large" block icon={<UnlockOutlined />}>
                  {isFirstTime ? "设置并解锁" : "解锁"}
                </Button>
              </Form.Item>
            </Form>
            
            {!isFirstTime && (
              <div style={{ marginTop: '16px' }}>
                <Button 
                  type="link" 
                  danger 
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() => setShowResetConfirm(true)}
                >
                  重置应用（清空所有数据）
                </Button>
              </div>
            )}
          </Card>
        </div>
        
        {/* 重置确认模态框 */}
        <Modal
          title="⚠️ 重置应用"
          open={showResetConfirm}
          onOk={resetApp}
          onCancel={() => setShowResetConfirm(false)}
          okText="确认重置"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <Alert
            message="危险操作"
            description="此操作将永久删除所有保存的登录信息，并重置主密码。此操作不可撤销！"
            type="error"
            style={{ marginBottom: '16px' }}
          />
          <p>确定要重置应用吗？重置后：</p>
          <ul>
            <li>所有登录信息将被永久删除</li>
            <li>主密码将被清除</li>
            <li>应用将回到初始状态</li>
          </ul>
        </Modal>
        
        {/* 主密码模态框（备用，通常不显示） */}
        <Modal
          title={isFirstTime ? "设置主密码" : "输入主密码"}
          open={showMasterPasswordModal && false} // 通常不显示，因为已经有卡片界面
          footer={null}
          closable={false}
          maskClosable={false}
        >
          <Form form={masterPasswordForm} onFinish={handleMasterPasswordSubmit}>
            <Form.Item
              name="masterPassword"
              rules={[{ required: true, message: '请输入主密码' }]}
            >
              <Input.Password 
                placeholder={isFirstTime ? "设置主密码" : "输入主密码"}
                autoFocus
              />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block>
                {isFirstTime ? "设置并解锁" : "解锁"}
              </Button>
            </Form.Item>
          </Form>
        </Modal>
      </Layout>
    );
  }

  // 应用已解锁，显示主界面
  return (
    <Layout style={{ height: '100vh' }}>
      <Header style={{ 
        background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 20px'
      }}>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <Title level={2} style={{ color: 'white', margin: 0 }}>
            📋 Copy Login Info
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.9)' }}>
            安全的登录信息管理工具
          </Text>
        </div>
        <Space>
          <Button 
            type="text" 
            icon={<ReloadOutlined />} 
            onClick={() => setShowResetConfirm(true)}
            style={{ color: 'white' }}
            title="重置应用"
          >
            重置
          </Button>
          <Button 
            type="text" 
            icon={<LogoutOutlined />} 
            onClick={lockApp}
            style={{ color: 'white' }}
          >
            锁定
          </Button>
        </Space>
      </Header>

      <Layout>
        <Sider width={300} style={{ background: '#f5f5f5' }}>
          <div style={{ padding: '20px' }}>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              block 
              size="large"
              onClick={showNewLoginForm}
            >
              新建登录信息
            </Button>
          </div>
          
          <div style={{ padding: '0 20px' }}>
            <Title level={4}>已保存的登录信息</Title>
            <List
              dataSource={loginList}
              renderItem={(name) => (
                <List.Item
                  style={{
                    cursor: 'pointer',
                    padding: '12px 16px',
                    margin: '8px 0',
                    background: selectedLogin === name ? '#1890ff' : 'white',
                    color: selectedLogin === name ? 'white' : 'inherit',
                    borderRadius: '6px',
                    border: '1px solid #d9d9d9'
                  }}
                  onClick={() => selectLoginItem(name)}
                >
                  <LockOutlined style={{ marginRight: 8 }} />
                  {name}
                </List.Item>
              )}
              locale={{ emptyText: '暂无保存的登录信息' }}
            />
          </div>
        </Sider>

        <Content style={{ padding: '24px', background: 'white' }}>
          {!currentLoginData ? (
            <Card style={{ textAlign: 'center', height: '100%' }}>
              <div style={{ paddingTop: '100px' }}>
                <Title level={2}>🔐 欢迎使用 Copy Login Info</Title>
                <Text type="secondary" style={{ fontSize: '16px' }}>
                  这是一个安全的登录信息管理工具，您可以：
                </Text>
                <ul style={{ textAlign: 'left', marginTop: '20px', fontSize: '14px' }}>
                  <li>🔒 安全地存储登录信息（使用AES-256加密）</li>
                  <li>📋 快速复制密码到剪贴板</li>
                  <li>🗂️ 分类管理多个账户信息</li>
                  <li>🔑 使用主密码保护所有数据</li>
                </ul>
                <Text type="secondary">
                  点击左侧的"新建登录信息"按钮开始使用吧！
                </Text>
              </div>
            </Card>
          ) : (
            <Card
              title={`${currentLoginData.name} - 登录信息`}
              extra={
                <Space>
                  <Button 
                    icon={<EditOutlined />}
                    onClick={showEditForm}
                  >
                    编辑
                  </Button>
                  <Popconfirm
                    title="确定要删除这个登录信息吗？"
                    description="此操作不可撤销"
                    onConfirm={deleteLogin}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button 
                      danger 
                      icon={<DeleteOutlined />}
                    >
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              }
            >
              <Descriptions column={1} bordered>
                <Descriptions.Item label="名称">
                  <Text>{currentLoginData.name}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="用户名">
                  <Space>
                    <Text code>{currentLoginData.username}</Text>
                    <Button
                      type="primary"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => copyToClipboard(currentLoginData.username, '用户名')}
                      style={{ minWidth: '60px' }}
                    >
                      复制
                    </Button>
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="密码">
                  <Space>
                    <Text code>
                      {showPassword ? currentLoginData.password : '••••••••'}
                    </Text>
                    <Button
                      type="default"
                      size="small"
                      icon={showPassword ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? '隐藏密码' : '显示密码'}
                    />
                    <Button
                      type="primary"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => copyToClipboard(currentLoginData.password, '密码')}
                      style={{ minWidth: '60px' }}
                    >
                      复制
                    </Button>
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="网址">
                  {currentLoginData.url ? (
                    <Space>
                      <Button
                        type="link"
                        onClick={() => openExternalUrl(currentLoginData.url!)}
                        style={{ padding: 0, height: 'auto' }}
                      >
                        {currentLoginData.url}
                      </Button>
                      <Button
                        type="primary"
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => copyToClipboard(currentLoginData.url!, '网址')}
                        style={{ minWidth: '60px' }}
                      >
                        复制
                      </Button>
                    </Space>
                  ) : (
                    '未设置'
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="备注">
                  {currentLoginData.notes ? (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Text>{currentLoginData.notes}</Text>
                      <Button
                        type="primary"
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => copyToClipboard(currentLoginData.notes!, '备注')}
                        style={{ minWidth: '60px' }}
                      >
                        复制
                      </Button>
                    </Space>
                  ) : (
                    '未设置'
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {formatDate(currentLoginData.createdAt)}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}
        </Content>
      </Layout>

      {/* 新建/编辑表单模态框 */}
      <Modal
        title={isEditing ? '编辑登录信息' : '新建登录信息'}
        open={isFormVisible}
        onCancel={() => {
          setIsFormVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleFormSubmit}
        >
          <Form.Item
            label="名称"
            name="name"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="例如：GitHub、Gmail等" />
          </Form.Item>

          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="用户名或邮箱" />
          </Form.Item>

          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="密码" />
          </Form.Item>

          <Form.Item
            label="网址"
            name="url"
          >
            <Input placeholder="https://example.com" />
          </Form.Item>

          <Form.Item
            label="备注"
            name="notes"
          >
            <Input.TextArea 
              placeholder="可以记录一些额外信息，如安全问题答案、特殊说明等" 
              rows={3}
              maxLength={500}
              showCount
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
              <Button onClick={() => {
                setIsFormVisible(false);
                form.resetFields();
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 重置确认模态框 */}
      <Modal
        title="⚠️ 重置应用"
        open={showResetConfirm}
        onOk={resetApp}
        onCancel={() => setShowResetConfirm(false)}
        okText="确认重置"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <Alert
          message="危险操作"
          description="此操作将永久删除所有保存的登录信息，并重置主密码。此操作不可撤销！"
          type="error"
          style={{ marginBottom: '16px' }}
        />
        <p>确定要重置应用吗？重置后：</p>
        <ul>
          <li>所有登录信息将被永久删除</li>
          <li>主密码将被清除</li>
          <li>应用将回到初始状态</li>
        </ul>
      </Modal>
    </Layout>
  );
};

export default App; 