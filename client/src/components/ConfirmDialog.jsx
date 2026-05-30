import { Modal } from 'antd';

/**
 * 确认弹窗封装（基于 antd Modal.confirm）。
 * 用法：
 *   ConfirmDialog.show({
 *     title: '确认删除？',
 *     content: '此操作不可撤销',
 *     onOk: () => handleDelete(),
 *   });
 */
const ConfirmDialog = {
  show: ({ title, content, onOk, onCancel, okText = '确认', cancelText = '取消' }) => {
    Modal.confirm({
      title,
      content,
      okText,
      cancelText,
      onOk,
      onCancel,
    });
  },
};

export default ConfirmDialog;
