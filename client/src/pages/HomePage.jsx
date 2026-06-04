import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Layout,
  List,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Loading from '../components/Loading';
import Toast from '../components/Toast';
import { getMe } from '../api/auth.api';
import { createItem, getItemDetail, listItems, updateItemPermissions } from '../api/item.api';
import useAuthStore, { isDebugPreviewEnabled } from '../store/authStore';

const { Content } = Layout;
const { Title, Paragraph, Text } = Typography;

const TYPE_LABELS = {
  Whiteboard: '白板',
  Document: '文档',
};

const ROLE_LABELS = {
  owner: '所有者',
  editor: '编辑者',
  viewer: '只读者',
};

const MOCK_USER = {
  user_id: 'debug-user-001',
  username: 'Preview User',
  email: 'preview@collab.local',
};

const INITIAL_MOCK_ITEMS = [
  {
    item_id: 'mock-item-board-001',
    title: '产品讨论白板',
    type: 'Whiteboard',
    owner_id: 'debug-user-001',
    is_public: false,
    created_at: '2026-06-04T08:00:00.000Z',
    updated_at: '2026-06-04T09:30:00.000Z',
    role: 'owner',
  },
  {
    item_id: 'mock-item-doc-001',
    title: '会议纪要文档',
    type: 'Document',
    owner_id: 'debug-user-002',
    is_public: false,
    created_at: '2026-06-03T08:00:00.000Z',
    updated_at: '2026-06-04T07:20:00.000Z',
    role: 'editor',
  },
];

const INITIAL_MOCK_ITEM_DETAILS = {
  'mock-item-board-001': {
    item_id: 'mock-item-board-001',
    title: '产品讨论白板',
    type: 'Whiteboard',
    owner_id: 'debug-user-001',
    is_public: false,
    created_at: '2026-06-04T08:00:00.000Z',
    updated_at: '2026-06-04T09:30:00.000Z',
    role: 'owner',
    owner: {
      user_id: 'debug-user-001',
      username: 'Preview User',
      email: 'preview@collab.local',
    },
    permissions: [
      {
        permission_id: 'mock-permission-001',
        role: 'editor',
        user: {
          user_id: 'debug-user-002',
          username: 'Alice Chen',
          email: 'alice@example.com',
        },
      },
      {
        permission_id: 'mock-permission-002',
        role: 'viewer',
        user: {
          user_id: 'debug-user-003',
          username: 'Bob Wang',
          email: 'bob@example.com',
        },
      },
    ],
  },
};

function HomePage() {
  const navigate = useNavigate();
  const debugPreview = isDebugPreviewEnabled();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberSubmitting, setMemberSubmitting] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedItemDetail, setSelectedItemDetail] = useState(null);
  const [mockItemDetails, setMockItemDetails] = useState(INITIAL_MOCK_ITEM_DETAILS);
  const [createForm] = Form.useForm();
  const [memberForm] = Form.useForm();
  const setUser = useAuthStore((s) => s.setUser);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      if (debugPreview) {
        setUser(MOCK_USER);
        setItems(INITIAL_MOCK_ITEMS);
        return;
      }
      const [me, itemList] = await Promise.all([getMe(), listItems()]);
      setUser(me);
      setItems(itemList);
    } finally {
      setLoading(false);
    }
  }, [debugPreview, setUser]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const itemStats = useMemo(() => {
    const whiteboards = items.filter((item) => item.type === 'Whiteboard').length;
    const documents = items.filter((item) => item.type === 'Document').length;
    return { total: items.length, whiteboards, documents };
  }, [items]);

  function navigateToItem(item) {
    if (debugPreview) {
      Toast.info('调试预览模式下仅展示项目管理页，暂不进入真实协作页');
      return;
    }
    if (item.type === 'Document') {
      navigate(`/doc/${item.item_id}`);
      return;
    }
    navigate(`/board/${item.item_id}`);
  }

  async function handleCreateFinish() {
    const values = await createForm.validateFields();
    setCreateSubmitting(true);
    try {
      if (debugPreview) {
        const now = new Date().toISOString();
        const item = {
          item_id: `mock-item-${Date.now()}`,
          title: values.title.trim(),
          type: values.type,
          owner_id: MOCK_USER.user_id,
          is_public: false,
          created_at: now,
          updated_at: now,
          role: 'owner',
        };
        setItems((prev) => [item, ...prev]);
        setMockItemDetails((prev) => ({
          ...prev,
          [item.item_id]: {
            ...item,
            owner: MOCK_USER,
            permissions: [],
          },
        }));
        Toast.success('调试项目已创建');
        setCreateOpen(false);
        createForm.resetFields();
        return;
      }

      const item = await createItem({
        title: values.title.trim(),
        type: values.type,
      });
      Toast.success('项目创建成功');
      setCreateOpen(false);
      createForm.resetFields();
      await loadDashboard();
      navigateToItem(item);
    } finally {
      setCreateSubmitting(false);
    }
  }

  async function openMemberModal(item) {
    setMemberOpen(true);
    setSelectedItem(item);
    setSelectedItemDetail(null);
    memberForm.setFieldsValue({ members: [] });
    setMemberLoading(true);
    try {
      if (debugPreview) {
        const detail = mockItemDetails[item.item_id] || {
          ...item,
          owner: MOCK_USER,
          permissions: [],
        };
        setSelectedItemDetail(detail);
        memberForm.setFieldsValue({
          members: detail.permissions.map((permission) => ({
            email: permission.user.email,
            role: permission.role,
          })),
        });
        return;
      }

      const detail = await getItemDetail(item.item_id);
      setSelectedItemDetail(detail);
      memberForm.setFieldsValue({
        members: detail.permissions.map((permission) => ({
          email: permission.user.email,
          role: permission.role,
        })),
      });
    } finally {
      setMemberLoading(false);
    }
  }

  async function handleSaveMembers() {
    if (!selectedItem) return;
    const values = await memberForm.validateFields();
    setMemberSubmitting(true);
    try {
      if (debugPreview) {
        const detail = {
          ...(selectedItemDetail || {
            ...selectedItem,
            owner: MOCK_USER,
            permissions: [],
          }),
          permissions: (values.members || []).map((member, index) => ({
            permission_id: `mock-permission-${selectedItem.item_id}-${index}`,
            role: member.role,
            user: {
              user_id: `mock-user-${index}`,
              username: member.email.split('@')[0],
              email: member.email,
            },
          })),
        };
        setSelectedItemDetail(detail);
        setMockItemDetails((prev) => ({
          ...prev,
          [selectedItem.item_id]: detail,
        }));
        Toast.success('调试成员权限已更新');
        setMemberOpen(false);
        return;
      }

      const detail = await updateItemPermissions(selectedItem.item_id, {
        members: values.members || [],
      });
      setSelectedItemDetail(detail);
      memberForm.setFieldsValue({
        members: detail.permissions.map((permission) => ({
          email: permission.user.email,
          role: permission.role,
        })),
      });
      Toast.success('成员权限已更新');
      await loadDashboard();
      setMemberOpen(false);
    } finally {
      setMemberSubmitting(false);
    }
  }

  if (loading) {
    return <Loading />;
  }

  return (
    <Layout style={{ minHeight: '100vh', background: '#f6f5f4' }}>
      <Navbar />
      <Content style={{ padding: '32px 24px 48px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <Card
            style={{
              borderRadius: 28,
              border: '1px solid rgba(0,0,0,0.08)',
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)',
              boxShadow: '0 18px 48px rgba(0,0,0,0.04)',
              marginBottom: 24,
            }}
            bodyStyle={{ padding: 32 }}
          >
            {debugPreview ? (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 20, borderRadius: 14 }}
                message="当前为调试预览模式"
                description="你可以直接查看项目管理页布局、创建演示项目和编辑成员权限，真实登录与数据库联调完成后再切回正式流程。"
              />
            ) : null}

            <Row gutter={[24, 24]} align="middle">
              <Col xs={24} lg={15}>
                <Space direction="vertical" size={14} style={{ width: '100%' }}>
                  <Tag color="blue" style={{ width: 'fit-content', borderRadius: 999, padding: '6px 12px' }}>
                    项目管理中心
                  </Tag>
                  <Title style={{ margin: 0, fontSize: 'clamp(2rem, 3vw, 3.4rem)', lineHeight: 1.05, letterSpacing: '-0.05em' }}>
                    把白板、文档和协作成员放到一个清晰的入口里
                  </Title>
                  <Paragraph style={{ marginBottom: 0, fontSize: 17, lineHeight: 1.8, color: '#615d59', maxWidth: 700 }}>
                    这里展示你可访问的全部项目。你可以创建新项目、进入对应协作页，也可以在自己拥有的项目里维护成员权限。
                  </Paragraph>
                </Space>
              </Col>
              <Col xs={24} lg={9}>
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Card size="small" style={{ borderRadius: 20, borderColor: 'rgba(0,0,0,0.08)' }}>
                    <Space size={16} wrap>
                      <div>
                        <Text type="secondary">项目总数</Text>
                        <Title level={3} style={{ margin: 0 }}>{itemStats.total}</Title>
                      </div>
                      <div>
                        <Text type="secondary">白板</Text>
                        <Title level={4} style={{ margin: 0 }}>{itemStats.whiteboards}</Title>
                      </div>
                      <div>
                        <Text type="secondary">文档</Text>
                        <Title level={4} style={{ margin: 0 }}>{itemStats.documents}</Title>
                      </div>
                    </Space>
                  </Card>
                  <Button type="primary" size="large" style={{ height: 46, borderRadius: 10 }} onClick={() => setCreateOpen(true)}>
                    新建项目
                  </Button>
                </Space>
              </Col>
            </Row>
          </Card>

          <Card
            style={{
              borderRadius: 24,
              border: '1px solid rgba(0,0,0,0.08)',
            }}
            bodyStyle={{ padding: 24 }}
          >
            <Space direction="vertical" size={20} style={{ width: '100%' }}>
              <div>
                <Title level={4} style={{ marginBottom: 4 }}>我的协作项目</Title>
                <Text type="secondary">按最近更新时间排序，直接进入对应页面。</Text>
              </div>

              {items.length === 0 ? (
                <Empty
                  description="你还没有任何协作项目"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <Button type="primary" onClick={() => setCreateOpen(true)}>创建第一个项目</Button>
                </Empty>
              ) : (
                <Row gutter={[16, 16]}>
                  {items.map((item) => (
                    <Col xs={24} md={12} xl={8} key={item.item_id}>
                      <Card
                        hoverable
                        style={{ height: '100%', borderRadius: 20, borderColor: 'rgba(0,0,0,0.08)' }}
                        bodyStyle={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 18 }}
                      >
                        <Space direction="vertical" size={10} style={{ width: '100%' }}>
                          <Space wrap>
                            <Tag color={item.type === 'Whiteboard' ? 'geekblue' : 'green'}>
                              {TYPE_LABELS[item.type] || item.type}
                            </Tag>
                            <Tag>{ROLE_LABELS[item.role] || item.role}</Tag>
                          </Space>
                          <Title level={4} style={{ margin: 0 }}>{item.title}</Title>
                          <Text type="secondary">最近更新：{new Date(item.updated_at).toLocaleString()}</Text>
                        </Space>

                        <div style={{ marginTop: 'auto' }}>
                          <Space wrap>
                            <Button type="primary" onClick={() => navigateToItem(item)}>
                              进入项目
                            </Button>
                            {item.role === 'owner' ? (
                              <Button onClick={() => openMemberModal(item)}>管理成员</Button>
                            ) : null}
                          </Space>
                        </div>
                      </Card>
                    </Col>
                  ))}
                </Row>
              )}
            </Space>
          </Card>
        </div>
      </Content>

      <Modal
        title="新建协作项目"
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false);
          createForm.resetFields();
        }}
        onOk={handleCreateFinish}
        okText="创建并进入"
        confirmLoading={createSubmitting}
        destroyOnClose
      >
        <Form
          form={createForm}
          layout="vertical"
          requiredMark={false}
          initialValues={{ type: 'Whiteboard' }}
        >
          <Form.Item
            label="项目标题"
            name="title"
            rules={[
              { required: true, message: '请输入项目标题' },
              { max: 256, message: '标题不能超过 256 个字符' },
            ]}
          >
            <Input placeholder="例如：需求评审白板" />
          </Form.Item>
          <Form.Item label="项目类型" name="type" rules={[{ required: true, message: '请选择项目类型' }]}>
            <Select
              options={[
                { label: '白板', value: 'Whiteboard' },
                { label: '文档', value: 'Document' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={selectedItem ? `成员权限管理 · ${selectedItem.title}` : '成员权限管理'}
        open={memberOpen}
        onCancel={() => {
          setMemberOpen(false);
          setSelectedItem(null);
          setSelectedItemDetail(null);
          memberForm.resetFields();
        }}
        onOk={handleSaveMembers}
        okText="保存"
        confirmLoading={memberSubmitting}
        width={760}
        destroyOnClose
      >
        {memberLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '36px 0' }}>
            <Spin />
          </div>
        ) : (
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            {selectedItemDetail ? (
              <Card size="small" style={{ borderRadius: 16, borderColor: 'rgba(0,0,0,0.08)' }}>
                <Space direction="vertical" size={4}>
                  <Text strong>项目所有者</Text>
                  <Text>{selectedItemDetail.owner.username} · {selectedItemDetail.owner.email}</Text>
                </Space>
              </Card>
            ) : null}

            <Form form={memberForm} layout="vertical" requiredMark={false}>
              <Form.List name="members">
                {(fields, { add, remove }) => (
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    {fields.length === 0 ? (
                      <List
                        bordered
                        dataSource={[{ key: 'empty', text: '当前没有额外成员，点击下方按钮即可添加。' }]}
                        renderItem={(item) => <List.Item>{item.text}</List.Item>}
                      />
                    ) : null}

                    {fields.map((field) => (
                      <Card key={field.key} size="small" style={{ borderRadius: 16, borderColor: 'rgba(0,0,0,0.08)' }}>
                        <Row gutter={[12, 12]} align="middle">
                          <Col xs={24} md={12}>
                            <Form.Item
                              {...field}
                              label="成员邮箱"
                              name={[field.name, 'email']}
                              rules={[
                                { required: true, message: '请输入成员邮箱' },
                                { type: 'email', message: '邮箱格式不正确' },
                              ]}
                              style={{ marginBottom: 0 }}
                            >
                              <Input placeholder="member@example.com" />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={8}>
                            <Form.Item
                              {...field}
                              label="权限角色"
                              name={[field.name, 'role']}
                              rules={[{ required: true, message: '请选择角色' }]}
                              style={{ marginBottom: 0 }}
                            >
                              <Select
                                options={[
                                  { label: '编辑者', value: 'editor' },
                                  { label: '只读者', value: 'viewer' },
                                ]}
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={4}>
                            <Button danger block style={{ marginTop: 29 }} onClick={() => remove(field.name)}>
                              删除
                            </Button>
                          </Col>
                        </Row>
                      </Card>
                    ))}

                    <Button onClick={() => add({ email: '', role: 'viewer' })}>添加成员</Button>
                  </Space>
                )}
              </Form.List>
            </Form>
          </Space>
        )}
      </Modal>
    </Layout>
  );
}

export default HomePage;
