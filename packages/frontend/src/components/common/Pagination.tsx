import React from 'react';
import { Pagination } from 'antd';

export interface PaginationProps {
  /** Current page number (1-indexed) */
  current: number;
  /** Number of items per page */
  pageSize: number;
  /** Total number of items */
  total: number;
  /** Callback when the page or pageSize changes */
  onChange: (page: number, pageSize: number) => void;
  /** Whether to show the page size changer */
  showSizeChanger?: boolean;
  /** Whether to show the total count text */
  showTotal?: boolean;
}

/**
 * AppPagination - A reusable pagination component wrapping Ant Design's Pagination.
 * Provides sensible defaults for Chinese-language applications.
 */
const AppPagination: React.FC<PaginationProps> = ({
  current,
  pageSize,
  total,
  onChange,
  showSizeChanger = true,
  showTotal = true,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        padding: '16px 0',
      }}
    >
      <Pagination
        current={current}
        pageSize={pageSize}
        total={total}
        onChange={onChange}
        showSizeChanger={showSizeChanger}
        showTotal={showTotal ? (total) => `共 ${total} 条` : undefined}
        pageSizeOptions={[10, 20, 50, 100]}
      />
    </div>
  );
};

export default AppPagination;
