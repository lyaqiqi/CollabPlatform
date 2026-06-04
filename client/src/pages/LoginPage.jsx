import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Form,
  Input,
  Layout,
  Row,
  Space,
  Typography,
} from 'antd';
import { Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { login } from '../api/auth.api';
import useAuthStore, { DEBUG_PREVIEW_KEY } from '../store/authStore';

const { Content } = Layout;
const { Title, Paragraph, Text } = Typography;

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const accessToken = useAuthStore((s) => s.accessToken);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [submitting, setSubmitting] = useState(false);
  const isDev = import.meta.env.DEV;

  if (accessToken) {
    return <Navigate to="/" replace />;
  }

  async function handleFinish(values) {
    setSubmitting(true);
    try {
      const result = await login({
        email: values.email,
        password: values.password,
      });
      setAuth(result);
      navigate('/', { replace: true });
    } finally {
      setSubmitting(false);
    }
  }

  function handleDebugPreview() {
    localStorage.setItem(DEBUG_PREVIEW_KEY, 'true');
    setAuth({
      accessToken: 'debug-preview-token',
      refreshToken: 'debug-preview-refresh-token',
      user: {
        user_id: 'debug-user-001',
        username: 'Preview User',
        email: 'preview@collab.local',
      },
    });
    navigate('/', { replace: true });
  }

  return (
    <Layout style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #f6f5f4 0%, #ffffff 45%)' }}>
      <Content style={{ padding: '48px 24px' }}>
        <Row gutter={[32, 32]} align="middle" style={{ maxWidth: 1160, margin: '0 auto', minHeight: 'calc(100vh - 96px)' }}>
          <Col xs={24} lg={13}>
            <Space direction="vertical" size={20} style={{ width: '100%' }}>
              <Text style={{ color: '#097fe8', fontWeight: 600, letterSpacing: 0.3 }}>COLLAB PLATFORM</Text>
              <Title style={{ margin: 0, fontSize: 'clamp(2.5rem, 4vw, 4.6rem)', lineHeight: 1.02, letterSpacing: '-0.06em', color: 'rgba(0,0,0,0.92)' }}>
                登录后继续你的协作工作流
              </Title>
              <Paragraph style={{ fontSize: 18, lineHeight: 1.8, color: '#615d59', maxWidth: 560, marginBottom: 0 }}>
                在同一个工作区里管理白板、文档与协作成员，让项目入口、权限协作和内容编辑保持统一体验。
              </Paragraph>
              <Space wrap size={[12, 12]}>
                <Card size="small" style={{ borderRadius: 16, borderColor: 'rgba(0,0,0,0.08)', background: '#ffffffcc' }}>
                  <Text strong>统一项目入口</Text>
                </Card>
                <Card size="small" style={{ borderRadius: 16, borderColor: 'rgba(0,0,0,0.08)', background: '#ffffffcc' }}>
                  <Text strong>自动恢复登录态</Text>
                </Card>
                <Card size="small" style={{ borderRadius: 16, borderColor: 'rgba(0,0,0,0.08)', background: '#ffffffcc' }}>
                  <Text strong>Token 自动刷新</Text>
                </Card>
              </Space>
            </Space>
          </Col>

          <Col xs={24} lg={11}>
            <Card
              style={{
                borderRadius: 24,
                border: '1px solid rgba(0,0,0,0.08)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.06)',
              }}
              bodyStyle={{ padding: 32 }}
            >
              <Space direction="vertical" size={20} style={{ width: '100%' }}>
                <div>
                  <Title level={3} style={{ marginBottom: 8 }}>欢迎回来</Title>
                  <Text type="secondary">输入你的账号信息，进入项目管理页。</Text>
                </div>

                {location.state?.message ? (
                  <Alert type="success" showIcon message={location.state.message} />
                ) : null}

                <Form layout="vertical" onFinish={handleFinish} requiredMark={false} initialValues={{ remember: true }}>
                  <Form.Item
                    label="邮箱"
                    name="email"
                    rules={[
                      { required: true, message: '请输入邮箱' },
                      { type: 'email', message: '请输入正确的邮箱格式' },
                    ]}
                  >
                    <Input size="large" placeholder="alice@example.com" />
                  </Form.Item>

                  <Form.Item
                    label="密码"
                    name="password"
                    rules={[
                      { required: true, message: '请输入密码' },
                      { min: 8, message: '密码长度不能少于 8 位' },
                    ]}
                  >
                    <Input.Password size="large" placeholder="请输入密码" />
                  </Form.Item>

                  <Form.Item name="remember" valuePropName="checked" style={{ marginBottom: 12 }}>
                    <Checkbox>记住当前登录状态</Checkbox>
                  </Form.Item>

                  <Button type="primary" htmlType="submit" size="large" loading={submitting} block style={{ height: 46, borderRadius: 10 }}>
                    登录
                  </Button>

                  {isDev ? (
                    <Button
                      size="large"
                      block
                      style={{ height: 46, borderRadius: 10, marginTop: 12 }}
                      onClick={handleDebugPreview}
                    >
                      调试预览项目管理页
                    </Button>
                  ) : null}
                </Form>

                <Text type="secondary">
                  还没有账号？ <Link to="/register">去注册</Link>
                </Text>
              </Space>
            </Card>
          </Col>
        </Row>
      </Content>
    </Layout>
  );
}

export default LoginPage;
