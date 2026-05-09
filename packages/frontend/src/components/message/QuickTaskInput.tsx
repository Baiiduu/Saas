import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Input, AutoComplete, Tag, Typography, Space } from 'antd';
import {
  FileTextOutlined,
  FormOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import { useDebounce } from '@/hooks/useDebounce';

const { Text } = Typography;

interface RefOption {
  [key: string]: unknown;
  value: string;
  label: React.ReactNode;
  kind: 'command' | 'resource';
  refType?: 'task' | 'doc';
  refItem?: QuickRefItem;
}

export interface QuickRefItem {
  id: string;
  type: 'task' | 'doc';
  label: string;
  description?: string;
}

export interface QuickTaskInputProps {
  /** Controlled input value */
  value?: string;
  /** Callback when value changes */
  onChange?: (value: string) => void;
  /** Callback when a @task or @doc reference is selected */
  onReferenceSelect?: (item: QuickRefItem) => void;
  /** Callback when the user submits the message */
  onSend?: (content: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Function to search for tasks/docs by keyword */
  onSearch?: (type: 'task' | 'doc', keyword: string) => Promise<QuickRefItem[]>;
}

/**
 * QuickTaskInput - Enhanced input with @task and @doc auto-complete support.
 * When the user types @task or @doc, an auto-complete dropdown shows matching items.
 */
const QuickTaskInput: React.FC<QuickTaskInputProps> = ({
  value: externalValue = '',
  onChange,
  onReferenceSelect,
  onSend,
  placeholder = '输入消息... (@ 引用任务或文档)',
  onSearch,
}) => {
  const [inputValue, setInputValue] = useState(externalValue);
  const [menuMode, setMenuMode] = useState<'command' | 'resource' | null>(null);
  const [triggerType, setTriggerType] = useState<'task' | 'doc' | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [options, setOptions] = useState<QuickRefItem[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedKeyword = useDebounce(searchKeyword, 300);

  // Sync external value
  useEffect(() => {
    setInputValue(externalValue);
  }, [externalValue]);

  // Search when debounced keyword changes
  useEffect(() => {
    if (menuMode !== 'resource' || !triggerType) {
      setOptions([]);
      return;
    }

    const performSearch = async () => {
      try {
        if (onSearch) {
          const results = await onSearch(triggerType, debouncedKeyword.trim());
          setOptions(results);
          setDropdownOpen(true);
        } else {
          // Default mock search
          const mockResults: QuickRefItem[] = [];
          if (debouncedKeyword.length > 0) {
            mockResults.push({
              id: `${triggerType}-mock-1`,
              type: triggerType,
              label: `示例${triggerType === 'task' ? '任务' : '文档'} "${debouncedKeyword}"`,
              description: `匹配 "${debouncedKeyword}" 的${triggerType === 'task' ? '任务' : '文档'}`,
            });
          }
          setOptions(mockResults);
          setDropdownOpen(mockResults.length > 0);
        }
      } catch {
        setOptions([]);
      }
    };

    performSearch();
  }, [menuMode, triggerType, debouncedKeyword, onSearch]);

  const handleChange = useCallback(
    (value: string) => {
      setInputValue(value);
      onChange?.(value);

      const resourceMatch = value.match(/@(task|doc)(?:\s+([^\n@]*))?$/i);
      if (resourceMatch) {
        setMenuMode('resource');
        setTriggerType(resourceMatch[1].toLowerCase() as 'task' | 'doc');
        setSearchKeyword(resourceMatch[2] || '');
        setDropdownOpen(true);
        return;
      }

      const commandMatch = value.match(/@([a-z]*)$/i);
      if (commandMatch) {
        setMenuMode('command');
        setTriggerType(null);
        setSearchKeyword(commandMatch[1] || '');
        setDropdownOpen(true);
      } else {
        setMenuMode(null);
        setTriggerType(null);
        setSearchKeyword('');
        setDropdownOpen(false);
      }
    },
    [onChange]
  );

  const handleSelect = useCallback(
    (_value: string, option: Record<string, unknown>) => {
      const selected = option as unknown as RefOption;

      if (selected.kind === 'command' && selected.refType) {
        const newValue = inputValue.replace(/@[a-z]*$/i, `@${selected.refType} `);
        setInputValue(newValue);
        onChange?.(newValue);
        setMenuMode('resource');
        setTriggerType(selected.refType);
        setSearchKeyword('');
        setDropdownOpen(true);
        return;
      }

      const item = selected.refItem;
      if (item) {
        // Replace the @trigger keyword with the selected reference
        const newValue = inputValue.replace(
          new RegExp(`@${item.type}\\s*[^\\n@]*$`),
          `@[${item.type}|${item.label}](${item.id}) `
        );
        setInputValue(newValue);
        onChange?.(newValue);
        onReferenceSelect?.(item);
        setDropdownOpen(false);
        setMenuMode(null);
        setTriggerType(null);
      }
    },
    [inputValue, onChange, onReferenceSelect]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        if (dropdownOpen) {
          return;
        }
        e.preventDefault();
        if (inputValue.trim()) {
          onSend?.(inputValue);
          setInputValue('');
          onChange?.('');
        }
      }
    },
    [dropdownOpen, inputValue, onSend, onChange]
  );

  const autoCompleteOptions = useMemo(
    (): RefOption[] => {
      if (menuMode === 'command') {
        const normalizedKeyword = searchKeyword.toLowerCase();
        const commandOptions: RefOption[] = [
          {
            value: '__command_task__',
            kind: 'command',
            refType: 'task',
            label: (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                <FormOutlined style={{ color: '#52c41a' }} />
                <div>
                  <Text style={{ fontSize: 13 }}>引用任务</Text>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                    选择后继续搜索并插入任务引用
                  </Text>
                </div>
              </div>
            ),
          },
          {
            value: '__command_doc__',
            kind: 'command',
            refType: 'doc',
            label: (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                <FileTextOutlined style={{ color: '#1677ff' }} />
                <div>
                  <Text style={{ fontSize: 13 }}>引用文档</Text>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                    选择后继续搜索并插入文档引用
                  </Text>
                </div>
              </div>
            ),
          },
        ];
        return commandOptions.filter((item) => !normalizedKeyword || item.refType?.includes(normalizedKeyword));
      }

      return options.map((item) => ({
        value: item.id,
        kind: 'resource',
        refItem: item,
        label: (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 0',
            }}
          >
            {item.type === 'task' ? (
              <FormOutlined style={{ color: '#52c41a' }} />
            ) : (
              <FileTextOutlined style={{ color: '#1677ff' }} />
            )}
            <div>
              <Text style={{ fontSize: 13 }}>{item.label}</Text>
              {item.description && (
                <Text
                  type="secondary"
                  style={{ fontSize: 11, display: 'block' }}
                >
                  {item.description}
                </Text>
              )}
            </div>
          </div>
        ),
      }));
    },
    [menuMode, options, searchKeyword]
  );

  return (
    <div style={{ position: 'relative' }}>
      {/* Hint badges */}
      <div style={{ marginBottom: 4 }}>
        <Space size={4}>
          <Tag
            icon={<FormOutlined />}
            color="green"
            style={{ fontSize: 10, lineHeight: '16px', margin: 0 }}
          >
            @task 引用任务
          </Tag>
          <Tag
            icon={<FileTextOutlined />}
            color="blue"
            style={{ fontSize: 10, lineHeight: '16px', margin: 0 }}
          >
            @doc 引用文档
          </Tag>
          <Tag
            icon={<BulbOutlined />}
            color="orange"
            style={{ fontSize: 10, lineHeight: '16px', margin: 0 }}
          >
            Shift+Enter 换行
          </Tag>
        </Space>
      </div>
      <AutoComplete
        value={inputValue}
        options={autoCompleteOptions}
        onSelect={handleSelect}
        open={dropdownOpen}
        onDropdownVisibleChange={setDropdownOpen}
        style={{ width: '100%' }}
      >
        <Input.TextArea
          ref={inputRef as React.Ref<any>}
          value={inputValue}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={2}
          style={{ resize: 'none' }}
        />
      </AutoComplete>
    </div>
  );
};

export default QuickTaskInput;
