import { message } from 'antd';

/**
 * 全局消息提示封装（基于 antd message）。
 * 用法：Toast.success('操作成功') / Toast.error('出错了') / Toast.info('提示')
 */
const Toast = {
  success: (content, duration = 2) => message.success(content, duration),
  error: (content, duration = 3) => message.error(content, duration),
  info: (content, duration = 2) => message.info(content, duration),
};

export default Toast;
