import { Button, Space, Popconfirm } from 'antd';
import { PlayCircleOutlined, LoadingOutlined, ReloadOutlined } from '@ant-design/icons';

interface ActionBarProps {
  onDebug: () => void;
  onClear: () => void;
  isDebugging: boolean;
}

export default function ActionBar({ onDebug, onClear, isDebugging }: ActionBarProps) {
  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: '12px 16px',
      background: '#fff',
      borderTop: '1px solid #f0f0f0',
    }}>
      <Space>
        <Button
          type="primary"
          icon={isDebugging ? <LoadingOutlined /> : <PlayCircleOutlined />}
          onClick={onDebug}
          disabled={isDebugging}
        >
          {isDebugging ? '调试中...' : '发起调试'}
        </Button>
        <Popconfirm
          title="确定清空所有参数？"
          onConfirm={onClear}
          okText="确定"
          cancelText="取消"
        >
          <Button icon={<ReloadOutlined />}>
            全部清空
          </Button>
        </Popconfirm>
      </Space>
    </div>
  );
}