import { Spin } from 'antd';

/**
 * 全屏居中加载状态组件
 */
function Loading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <Spin size="large" />
    </div>
  );
}

export default Loading;
