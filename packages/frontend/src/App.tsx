import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AppRouter } from '@/router';
import { useUIStore } from '@/stores/uiStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // TODO: Implement actual auth provider in a future task
  return <>{children}</>;
};

export const App: React.FC = () => {
  const themeMode = useUIStore((state) => state.themeMode);

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider
          locale={zhCN}
          theme={{
            algorithm: themeMode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
          }}
        >
          <BrowserRouter>
            <AppRouter />
          </BrowserRouter>
        </ConfigProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
};
