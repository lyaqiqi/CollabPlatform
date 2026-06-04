import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Layout,
  Row,
  Space,
  Typography,
} from 'antd';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { register } from '../api/auth.api';
import useAuthStore from '../store/authStore';
import Toast from '../components/Toast';

const { Content } = Layout;
const { Title, Paragraph, Text } = Typography;

function RegisterPage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [submitting, setSubmitting] = useState(false);

  if (accessToken) {
    return <Navigate to="/" replace />;
  }

  async function handleFinish(values) {
    setSubmitting(true);
    try {
      await register({
        username: values.username.trim(),
        email: values.email.trim(),
        password: values.password,
      });
      Toast.success('注册成功');
      navigate('/login', {
        replace: true,
        state: { message: '注册成功，请登录' },
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #ffffff 0%, #f6f5f4 100%)' }}>
      <Content style={{ padding: '48px 24px' }}>
        <Row gutter={[32, 32]} align="middle" style={{ maxWidth: 1160, margin: '0 auto', minHeight: 'calc(100vh - 96px)' }}>
          <Col xs={24} lg={12}>
            <Space direction="vertical" size={18} style={{ width: '100%' }}>
              <Text style={{ color: '#097fe8', fontWeight: 600, letterSpacing: 0.3 }}>GET STARTED</Text>
              <Title style={{ margin: 0, fontSize: 'clamp(2.3rem, 3.8vw, 4.3rem)', lineHeight: 1.03, letterSpacing: '-0.05em', color: 'rgba(0,0,0,0.92)' }}>
                注册一个账号，开始管理协作项目
              </Title>
              <Paragraph style={{ fontSize: 18, lineHeight: 1.8, color: '#615d59', maxWidth: 520, marginBottom: 0 }}>
                注册完成后你就可以创建白板或文档项目，并统一管理项目成员权限，快速进入协作空间。
              </Paragraph>
            </Space>
          </Col>

          <Col xs={24} lg={12}>
            <Card
              style={{
                borderRadius: 24,
                border: '1px solid rgba(0,0,0,0.08)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.05)',
              }}
              bodyStyle={{ padding: 32 }}
            >
              <Space direction="vertical" size={20} style={{ width: '100%' }}>
                <div>
                  <Title level={3} style={{ marginBottom: 8 }}>创建账号</Title>
                  <Text type="secondary">填写基础信息后即可进入登录流程。</Text>
                </div>

                <Form layout="vertical" onFinish={handleFinish} requiredMark={false}>
                  <Form.Item
                    label="用户名"
                    name="username"
                    rules={[
                      { required: true, message: '请输入用户名' },
                      { max: 32, message: '用户名最多 32 个字符' },
                    ]}
                  >
                    <Input size="large" placeholder="alice" />
                  </Form.Item>

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
                    <Input.Password size="large" placeholder="至少 8 位密码" />
                  </Form.Item>

                  <Form.Item
                    label="确认密码"
                    name="confirmPassword"
                    dependencies={['password']}
                    rules={[
                      { required: true, message: '请再次输入密码' },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue('password') === value) {
                            return Promise.resolve();
                          }
                          return Promise.reject(new Error('两次输入的密码不一致'));
                        },
                      }),
                    ]}
                  >
                    <Input.Password size="large" placeholder="再次输入密码" />
                  </Form.Item>

                  <Button type="primary" htmlType="submit" size="large" loading={submitting} block style={{ height: 46, borderRadius: 10 }}>
                    注册账号
                  </Button>
                </Form>

                <Text type="secondary">
                  已有账号？ <Link to="/login">返回登录</Link>
                </Text>
              </Space>
            </Card>
          </Col>
        </Row>
      </Content>
    </Layout>
  );
}

export default RegisterPage;
