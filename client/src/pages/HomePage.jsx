import { Layout, Typography } from 'antd';
import Navbar from '../components/Navbar';

const { Content } = Layout;

// TODO: 由 D 实现项目列表（获取当前用户的协作项目，支持新建/进入白板/文档）
function HomePage() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Navbar />
      <Content style={{ padding: 24, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Typography.Title level={2}>项目列表页 — 由 D 实现</Typography.Title>
      </Content>
    </Layout>
  );
}

export default HomePage;
