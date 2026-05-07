import React from 'react';
import { Spin } from 'antd';

export interface LoadingProps {
  /** Tooltip text displayed below the spinner */
  tip?: string;
  /** If true, renders a full-height centered spinner */
  fullscreen?: boolean;
  /** Size of the spinner */
  size?: 'small' | 'default' | 'large';
}

/**
 * Loading - A reusable loading spinner component.
 * When `fullscreen` is true, the spinner is centered and fills the container.
 */
const Loading: React.FC<LoadingProps> = ({
  tip = '加载中...',
  fullscreen = false,
  size = 'large',
}) => {
  if (fullscreen) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          width: '100%',
        }}
      >
        <Spin tip={tip} size={size}>
          {/* Spin with children requires a wrapper div for tip to show */}
          <div style={{ padding: 50 }} />
        </Spin>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
      }}
    >
      <Spin tip={tip} size={size}>
        <div style={{ padding: 50 }} />
      </Spin>
    </div>
  );
};

export default Loading;
