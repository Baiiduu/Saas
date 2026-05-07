import React, { useState, useEffect } from 'react';
import { Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useDebounce } from '@/hooks/useDebounce';

export interface SearchInputProps {
  /** Controlled value */
  value?: string;
  /** Callback fired when the value changes (debounced) */
  onChange?: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Callback fired when the user presses Enter or clicks the search icon */
  onSearch?: (value: string) => void;
  /** Debounce delay in milliseconds (default: 300) */
  debounceMs?: number;
}

/**
 * SearchInput - A controlled search input with debounced onChange.
 * Uses `useDebounce` internally to reduce the frequency of onChange callbacks.
 * Also supports an immediate `onSearch` callback on Enter/submit.
 */
const SearchInput: React.FC<SearchInputProps> = ({
  value: externalValue = '',
  onChange,
  placeholder = '搜索...',
  onSearch,
  debounceMs = 300,
}) => {
  const [inputValue, setInputValue] = useState<string>(externalValue);
  const debouncedValue = useDebounce(inputValue, debounceMs);

  // Sync external value changes
  useEffect(() => {
    setInputValue(externalValue);
  }, [externalValue]);

  // Fire debounced onChange
  useEffect(() => {
    if (debouncedValue !== externalValue) {
      onChange?.(debouncedValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleSearch = (value: string) => {
    onSearch?.(value);
  };

  return (
    <Input
      prefix={<SearchOutlined style={{ color: 'rgba(0,0,0,0.45)' }} />}
      placeholder={placeholder}
      value={inputValue}
      onChange={handleChange}
      onPressEnter={() => handleSearch(inputValue)}
      allowClear
      style={{ width: 240 }}
    />
  );
};

export default SearchInput;
