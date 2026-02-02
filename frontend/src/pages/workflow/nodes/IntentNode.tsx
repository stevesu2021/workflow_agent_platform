import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { CompassOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { Popover, Descriptions, Typography, Tag } from 'antd';

const { Text } = Typography;

export const IntentNode = ({ data, selected }: NodeProps) => {
  const [open, setOpen] = useState(false);
  const debugData = data._debugData;

  // Get intents from data (configured by user)
  const intents = data.intents || data.output_params || [];
  const intentsCount = intents.length;

  // Get intent preview from debug data
  const intentPreview = debugData?.output?.intent_name ||
                       (debugData?.output?.intent === 'unknown' ? '未知意图' : '-');

  const confidence = debugData?.output?.confidence;
  const confidenceColor = confidence >= 0.7 ? 'success' : confidence >= 0.4 ? 'warning' : 'default';

  const content = (
      <div style={{ maxWidth: 400, maxHeight: 350, overflow: 'auto' }}>
          <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="Timestamp">{debugData?.timestamp}</Descriptions.Item>
              <Descriptions.Item label="Input">
                  <div style={{ fontSize: '11px', wordBreak: 'break-word' }}>
                      {debugData?.inputs?.user_input || '-'}
                  </div>
              </Descriptions.Item>
              <Descriptions.Item label="Matched Intent">
                  <Tag color={confidenceColor}>
                      {debugData?.output?.intent_name || debugData?.output?.intent || '-'}
                  </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Confidence">
                  {confidence !== undefined ? `${(confidence * 100).toFixed(1)}%` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Extracted Slots">
                  <pre style={{ fontSize: 10, margin: 0 }}>
                      {JSON.stringify(debugData?.output?.slots || {}, null, 2)}
                  </pre>
              </Descriptions.Item>
              {debugData?.error && (
                  <Descriptions.Item label="Error">
                      <pre style={{ fontSize: 10, margin: 0, color: 'red' }}>
                          {debugData.error}
                      </pre>
                  </Descriptions.Item>
              )}
          </Descriptions>
      </div>
  );

  // Calculate handle positions based on number of intents
  const getHandleStyle = (index: number, total: number) => {
      if (total === 1) {
          return { left: '50%', transform: 'translateX(-50%)' };
      }
      // Distribute handles evenly across the bottom
      const percentage = ((index + 1) / (total + 1)) * 100;
      return { left: `${percentage}%` };
  };

  return (
    <Popover
        content={content}
        title="意图识别 - 上次执行"
        trigger="click"
        open={open}
        onOpenChange={setOpen}
    >
        <div
            style={{
                padding: '12px 16px',
                borderRadius: '8px',
                border: selected ? '2px solid #faad14' : '1px solid #faad14',
                background: '#fffbe6',
                color: '#faad14',
                minWidth: '200px',
                maxWidth: '350px',
                position: 'relative',
                boxShadow: selected ? '0 0 0 2px rgba(250, 173, 20, 0.2)' : '0 2px 5px rgba(0,0,0,0.1)',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <CompassOutlined style={{ fontSize: '16px' }} />
                <Text strong style={{ fontSize: '14px', color: '#faad14' }}>
                    {data.label || '意图识别'}
                </Text>
            </div>

            {/* Intents count badge */}
            <div
                style={{
                    marginTop: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    flexWrap: 'wrap'
                }}
            >
                <Tag color="orange" style={{ margin: 0 }}>
                    {intentsCount} 个意图
                </Tag>
                {intentPreview !== '-' && (
                    <Tag color={confidenceColor} style={{ margin: 0 }}>
                        {intentPreview}
                    </Tag>
                )}
            </div>

            {/* Intents list preview */}
            {intents.length > 0 && (
                <div
                    style={{
                        marginTop: '10px',
                        padding: '8px',
                        background: '#fff',
                        borderRadius: '4px',
                        border: '1px solid #ffe58f',
                        fontSize: '11px',
                        maxHeight: '80px',
                        overflow: 'auto'
                    }}
                >
                    {intents.map((intent: any, index: number) => (
                        <div key={index} style={{ marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: intent.is_fallback ? 'bold' : 'normal' }}>
                                {intent.name || intent.id || `意图${index + 1}`}
                            </span>
                            {intent.is_fallback && <Tag color="orange" style={{ fontSize: '9px', margin: 0 }}>默认</Tag>}
                        </div>
                    ))}
                </div>
            )}

            {/* Debug indicator */}
            {debugData && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: -10,
                        right: -10,
                        background: debugData.error ? '#ff4d4f' : '#52c41a',
                        color: '#fff',
                        borderRadius: '50%',
                        width: 20,
                        height: 20,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: 12
                    }}
                >
                    <InfoCircleOutlined />
                </div>
            )}

            {/* Input Handle */}
            <Handle
                type="target"
                position={Position.Top}
                id="input"
                style={{ background: '#faad14' }}
                isConnectable={true}
            />

            {/* Output Handles - one for each intent */}
            {intents.map((intent: any, index: number) => (
                <React.Fragment key={intent.id || intent.name || index}>
                    {/* Intent label above the handle */}
                    <div
                        style={{
                            position: 'absolute',
                            bottom: '8px',
                            ...getHandleStyle(index, intents.length),
                            transform: intents.length === 1 ? 'translateX(-50%)' : 'translateX(-50%)',
                            fontSize: '9px',
                            whiteSpace: 'nowrap',
                            color: '#666',
                            pointerEvents: 'none',
                            textAlign: 'center'
                        }}
                    >
                        {intent.name || intent.id || `意图${index + 1}`}
                    </div>
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id={intent.id || intent.name || `intent_${index}`}
                        style={{
                            background: intent.is_fallback ? '#ff4d4f' : '#faad14',
                            width: '10px',
                            height: '10px',
                            ...getHandleStyle(index, intents.length)
                        }}
                        isConnectable={true}
                    />
                </React.Fragment>
            ))}
        </div>
    </Popover>
  );
};
