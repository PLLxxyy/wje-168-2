import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Input, Button, message } from 'antd';
import { User, Lock, Mail } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const roleHomeMap: Record<string, string> = {
  employee: '/timesheet',
  supervisor: '/approvals',
  admin: '/admin/dashboard',
};

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async () => {
    if (!username || !password || !confirmPassword || !name) {
      message.warning('请填写所有必填项');
      return;
    }
    if (password !== confirmPassword) {
      message.error('两次密码输入不一致');
      return;
    }
    setLoading(true);
    try {
      const user = await register({ username, password, name, email });
      message.success('注册成功');
      navigate(roleHomeMap[user.role] || '/timesheet');
    } catch (err: any) {
      message.error(err?.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-8">注册账号</h1>

        <div className="space-y-4">
          <Input
            size="large"
            placeholder="用户名"
            prefix={<User size={16} className="text-gray-400" />}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Input.Password
            size="large"
            placeholder="密码"
            prefix={<Lock size={16} className="text-gray-400" />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input.Password
            size="large"
            placeholder="确认密码"
            prefix={<Lock size={16} className="text-gray-400" />}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <Input
            size="large"
            placeholder="姓名"
            prefix={<User size={16} className="text-gray-400" />}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            size="large"
            placeholder="邮箱（选填）"
            prefix={<Mail size={16} className="text-gray-400" />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Button
            type="primary"
            size="large"
            block
            loading={loading}
            onClick={handleSubmit}
            className="bg-blue-900"
          >
            注册
          </Button>
        </div>

        <div className="text-center mt-6">
          <span className="text-sm text-gray-500">已有账号？</span>
          <Link to="/login" className="text-sm text-blue-600 hover:text-blue-800 ml-1">
            返回登录
          </Link>
        </div>
      </div>
    </div>
  );
}
