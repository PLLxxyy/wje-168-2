import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Input, Button, message } from 'antd';
import { User, Lock } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const roleHomeMap: Record<string, string> = {
  employee: '/timesheet',
  supervisor: '/approvals',
  admin: '/admin/dashboard',
};

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async () => {
    if (!username || !password) {
      message.warning('请输入用户名和密码');
      return;
    }
    setLoading(true);
    try {
      const user = await login(username, password);
      message.success('登录成功');
      navigate(roleHomeMap[user.role] || '/timesheet');
    } catch (err: any) {
      message.error(err?.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-8">工时管理系统</h1>

        <div className="space-y-5">
          <Input
            size="large"
            placeholder="用户名"
            prefix={<User size={16} className="text-gray-400" />}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onPressEnter={handleSubmit}
          />
          <Input.Password
            size="large"
            placeholder="密码"
            prefix={<Lock size={16} className="text-gray-400" />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onPressEnter={handleSubmit}
          />

          <Button
            type="primary"
            size="large"
            block
            loading={loading}
            onClick={handleSubmit}
            className="bg-blue-900"
          >
            登录
          </Button>
        </div>

        <div className="text-center mt-6">
          <span className="text-sm text-gray-500">还没有账号？</span>
          <Link to="/register" className="text-sm text-blue-600 hover:text-blue-800 ml-1">
            立即注册
          </Link>
        </div>
      </div>
    </div>
  );
}
